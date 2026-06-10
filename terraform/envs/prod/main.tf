terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "registry-certs-terraform-state"
    key            = "registry-certs/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "registry-certs-terraform-lock"
    encrypt        = true
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" { type = string }
variable "route53_zone_id" { type = string }
variable "github_repository_url" { type = string }

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "registry-certs"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

module "stack" {
  source = "../env-stack"

  env                   = "prod"
  region                = var.region
  vpc_cidr              = "10.22.0.0/16"
  domain_name           = var.domain_name
  route53_zone_id       = var.route53_zone_id
  github_repository_url = var.github_repository_url
  trigger_branch        = "production"

  # Web edition (Express's 10GB/db cap is too small for real data). Note:
  # Multi-AZ needs Standard edition — revisit before real-production cutover.
  db_engine                = "sqlserver-web"
  db_instance_class        = "db.t3.large"
  db_allocated_storage     = 100
  db_backup_retention_days = 14

  cpu           = 1024
  memory        = 2048
  desired_count = 2
  autoscale_min = 2
  autoscale_max = 4

  app_environment_overrides = {
    # Keep marriage certs gated in prod until the city decides (legacy
    # MARRIAGE_CERTS_ENABLED behavior).
    MARRIAGE_CERTS_ENABLED = "0"
  }
}

output "app_url" { value = module.stack.app_url }
output "db_address" { value = module.stack.db_address }
output "codebuild_project" { value = module.stack.codebuild_project }
