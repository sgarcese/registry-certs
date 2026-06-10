# Composition module: everything one environment needs. The dev/staging/prod
# roots are thin wrappers over this with per-env sizing.

variable "env" { type = string }
variable "region" { type = string }
variable "vpc_cidr" { type = string }
variable "domain_name" { type = string }
variable "route53_zone_id" { type = string }
variable "github_repository_url" { type = string }
variable "trigger_branch" { type = string }

variable "db_engine" {
  type    = string
  default = "sqlserver-ex"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_backup_retention_days" {
  type    = number
  default = 1
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "autoscale_min" {
  type    = number
  default = 1
}

variable "autoscale_max" {
  type    = number
  default = 2
}

variable "app_environment_overrides" {
  type        = map(string)
  description = "Extra/overriding plain env vars for the app container"
  default     = {}
}

locals {
  db_name = "RegistryCommerce"
}

data "aws_ecr_repository" "app" {
  name = "registry-certs"
}

module "network" {
  source   = "../../modules/network"
  env      = var.env
  vpc_cidr = var.vpc_cidr
}

# App + CodeBuild security groups live here (not inside their modules) so the
# RDS module can reference them without a dependency cycle.
resource "aws_security_group" "app" {
  name_prefix = "registry-certs-${var.env}-app-"
  vpc_id      = module.network.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "codebuild" {
  name_prefix = "registry-certs-${var.env}-codebuild-"
  vpc_id      = module.network.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

module "alb" {
  source            = "../../modules/alb"
  env               = var.env
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  domain_name       = var.domain_name
  route53_zone_id   = var.route53_zone_id
}

module "rds" {
  source                = "../../modules/rds-mssql"
  env                   = var.env
  vpc_id                = module.network.vpc_id
  db_subnet_ids         = module.network.db_subnet_ids
  engine                = var.db_engine
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  backup_retention_days = var.db_backup_retention_days

  ingress_security_group_ids = [
    aws_security_group.app.id,
    aws_security_group.codebuild.id,
  ]
}

module "secrets" {
  source = "../../modules/secrets"
  env    = var.env
}

module "ecs_app" {
  source = "../../modules/ecs-app"

  env                   = var.env
  vpc_id                = module.network.vpc_id
  app_subnet_ids        = module.network.app_subnet_ids
  target_group_arn      = module.alb.target_group_arn
  alb_security_group_id = module.alb.alb_security_group_id
  app_security_group_id = aws_security_group.app.id
  ecr_repository_url    = data.aws_ecr_repository.app.repository_url

  cpu           = var.cpu
  memory        = var.memory
  desired_count = var.desired_count
  autoscale_min = var.autoscale_min
  autoscale_max = var.autoscale_max

  environment_variables = merge(
    {
      NODE_ENV                  = "production"
      PORT                      = "3000"
      PUBLIC_HOST               = var.domain_name
      REGISTRY_DATA_DB_SERVER   = module.rds.db_address
      REGISTRY_DATA_DB_DATABASE = local.db_name
      REGISTRY_DATA_DB_USER     = "registry_app"
      # Prototype drivers: stubbed business integrations. Flip per env via
      # app_environment_overrides when real credentials are ready.
      PAYMENTS_DRIVER        = "stub"
      EMAIL_DRIVER           = "log"
      CONTACT_FORM_DRIVER    = "stub"
      MARRIAGE_CERTS_ENABLED = "1"
      ROLLBAR_ENVIRONMENT    = var.env
      ROOT_REDIRECT_URL      = "/birth"
    },
    var.app_environment_overrides
  )

  secrets = module.secrets.task_secrets
}

module "codebuild" {
  source = "../../modules/codebuild"

  env                   = var.env
  region                = var.region
  github_repository_url = var.github_repository_url
  trigger_branch        = var.trigger_branch
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.app_subnet_ids
  security_group_id     = aws_security_group.codebuild.id
  ecr_repository_arn    = data.aws_ecr_repository.app.arn
  ecr_repository_url    = data.aws_ecr_repository.app.repository_url
  ecs_cluster_name      = module.ecs_app.cluster_name
  ecs_service_name      = module.ecs_app.service_name
  task_family           = module.ecs_app.task_family
  task_role_arn         = module.ecs_app.task_role_arn
  execution_role_arn    = module.ecs_app.execution_role_arn
  db_master_secret_arn  = module.rds.master_user_secret_arn
  db_address            = module.rds.db_address
  db_name               = local.db_name
  app_secret_arn        = module.secrets.secret_arn
}

# Basic operational alarms.
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "registry-certs-${var.env}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = module.alb.alb_arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "registry-certs-${var.env}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 85

  dimensions = {
    DBInstanceIdentifier = "registry-certs-${var.env}"
  }
}

output "app_url" { value = "https://${var.domain_name}" }
output "alb_dns_name" { value = module.alb.alb_dns_name }
output "db_address" { value = module.rds.db_address }
output "db_master_secret_arn" { value = module.rds.master_user_secret_arn }
output "app_secret_arn" { value = module.secrets.secret_arn }
output "codebuild_project" { value = module.codebuild.project_name }
