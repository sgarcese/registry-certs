# Per-environment CodeBuild deploy project: test -> build -> push ECR ->
# run DB migrations (VPC-attached) -> register image-only task-def revision ->
# update ECS service. Triggered by GitHub webhook on the env's branch.

variable "env" { type = string }
variable "region" { type = string }

variable "github_repository_url" {
  type        = string
  description = "https://github.com/<org>/registry-certs.git"
}

variable "trigger_branch" {
  type        = string
  description = "Branch that deploys this environment (main/staging/production)"
}

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "ecr_repository_arn" { type = string }
variable "ecr_repository_url" { type = string }
variable "ecs_cluster_name" { type = string }
variable "ecs_service_name" { type = string }
variable "task_family" { type = string }
variable "task_role_arn" { type = string }
variable "execution_role_arn" { type = string }
variable "db_master_secret_arn" { type = string }
variable "db_address" { type = string }
variable "db_name" { type = string }
variable "app_secret_arn" { type = string }

data "aws_caller_identity" "current" {}

variable "security_group_id" {
  type        = string
  description = "SG for VPC-attached builds (created in the env root to avoid a cycle with the RDS module)"
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "registry-certs-${var.env}-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "codebuild" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/codebuild/registry-certs-${var.env}*"]
  }

  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid = "EcsDeploy"
    actions = [
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:DescribeServices",
      "ecs:UpdateService",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = [var.task_role_arn, var.execution_role_arn]
  }

  statement {
    sid       = "ReadDbMasterSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_master_secret_arn, var.app_secret_arn]
  }

  # VPC-attached builds need ENI management.
  statement {
    sid = "VpcNetworking"
    actions = [
      "ec2:CreateNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DeleteNetworkInterface",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeDhcpOptions",
      "ec2:DescribeVpcs",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "VpcEniPermission"
    actions   = ["ec2:CreateNetworkInterfacePermission"]
    resources = ["arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:network-interface/*"]
  }
}

resource "aws_iam_role_policy" "codebuild" {
  name   = "deploy"
  role   = aws_iam_role.codebuild.id
  policy = data.aws_iam_policy_document.codebuild.json
}

resource "aws_codebuild_project" "deploy" {
  name          = "registry-certs-deploy-${var.env}"
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = 30

  source {
    type            = "GITHUB"
    location        = var.github_repository_url
    buildspec       = "ci/buildspec.yml"
    git_clone_depth = 1
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_MEDIUM"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true # docker build

    environment_variable {
      name  = "DEPLOY_ENV"
      value = var.env
    }

    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }

    environment_variable {
      name  = "ECR_REPOSITORY_URL"
      value = var.ecr_repository_url
    }

    environment_variable {
      name  = "ECS_CLUSTER"
      value = var.ecs_cluster_name
    }

    environment_variable {
      name  = "ECS_SERVICE"
      value = var.ecs_service_name
    }

    environment_variable {
      name  = "TASK_FAMILY"
      value = var.task_family
    }

    environment_variable {
      name  = "DB_MASTER_SECRET_ARN"
      value = var.db_master_secret_arn
    }

    environment_variable {
      name  = "APP_SECRET_ARN"
      value = var.app_secret_arn
    }

    environment_variable {
      name  = "REGISTRY_DATA_DB_SERVER"
      value = var.db_address
    }

    environment_variable {
      name  = "REGISTRY_DATA_DB_DATABASE"
      value = var.db_name
    }
  }

  vpc_config {
    vpc_id             = var.vpc_id
    subnets            = var.private_subnet_ids
    security_group_ids = [var.security_group_id]
  }

  logs_config {
    cloudwatch_logs {
      group_name = "/codebuild/registry-certs-${var.env}"
    }
  }
}

# Webhook: deploy on push to the environment's branch. Requires a GitHub
# OAuth/app connection authorized once per account (aws codebuild
# import-source-credentials).
resource "aws_codebuild_webhook" "deploy" {
  project_name = aws_codebuild_project.deploy.name
  build_type   = "BUILD"

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH"
    }

    filter {
      type    = "HEAD_REF"
      pattern = "^refs/heads/${var.trigger_branch}$"
    }
  }
}


output "project_name" { value = aws_codebuild_project.deploy.name }
