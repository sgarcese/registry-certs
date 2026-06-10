# ECS Fargate service for the Next.js app.
#
# Division of ownership with CI: Terraform owns the task-definition template
# (roles, secrets wiring, sizing); CodeBuild registers image-only revisions
# and updates the service. lifecycle.ignore_changes keeps `terraform apply`
# from rolling deployments back.

variable "env" { type = string }
variable "vpc_id" { type = string }
variable "app_subnet_ids" { type = list(string) }
variable "target_group_arn" { type = string }
variable "alb_security_group_id" { type = string }
variable "ecr_repository_url" { type = string }

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

variable "environment_variables" {
  type        = map(string)
  description = "Plain (non-secret) environment variables for the container"
  default     = {}
}

variable "secrets" {
  type        = map(string)
  description = "Map of env var name -> Secrets Manager ARN (with optional :json-key suffix)"
  default     = {}
}

variable "app_security_group_id" {
  type        = string
  description = "SG for the Fargate tasks (created in the env root to avoid a cycle with the RDS module)"
}

data "aws_region" "current" {}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/registry-certs-${var.env}"
  retention_in_days = var.env == "prod" ? 90 : 30
}

resource "aws_security_group_rule" "app_from_alb" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = var.app_security_group_id
  source_security_group_id = var.alb_security_group_id
}

resource "aws_ecs_cluster" "main" {
  name = "registry-certs-${var.env}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execution role: pulls the image, writes logs, reads the secrets injected
# into the task definition.
resource "aws_iam_role" "execution" {
  name               = "registry-certs-${var.env}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for arn in values(var.secrets) : split("::", arn)[0]]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count  = length(var.secrets) > 0 ? 1 : 0
  name   = "read-app-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# Task role: what the app itself can do. Empty by default — the app talks to
# RDS/Stripe/Postmark over the network, not AWS APIs.
resource "aws_iam_role" "task" {
  name               = "registry-certs-${var.env}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_ecs_task_definition" "app" {
  family                   = "registry-certs-${var.env}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = "${var.ecr_repository_url}:${var.env}"
      essential = true

      portMappings = [
        { containerPort = 3000, protocol = "tcp" }
      ]

      environment = [
        for name, value in var.environment_variables : {
          name  = name
          value = value
        }
      ]

      secrets = [
        for name, arn in var.secrets : {
          name      = name
          valueFrom = arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "app"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "registry-certs"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.app_subnet_ids
    security_groups = [var.app_security_group_id]
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "app"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    # CI owns image revisions and scaling owns desired_count.
    ignore_changes = [task_definition, desired_count]
  }
}

resource "aws_appautoscaling_target" "app" {
  max_capacity       = var.autoscale_max
  min_capacity       = var.autoscale_min
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "cpu-60"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.app.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

output "cluster_name" { value = aws_ecs_cluster.main.name }
output "service_name" { value = aws_ecs_service.app.name }

output "task_family" { value = aws_ecs_task_definition.app.family }
output "task_role_arn" { value = aws_iam_role.task.arn }
output "execution_role_arn" { value = aws_iam_role.execution.arn }
