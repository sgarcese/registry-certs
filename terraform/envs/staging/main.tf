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
    key            = "registry-certs/staging/terraform.tfstate"
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
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

module "stack" {
  source = "../env-stack"

  env                   = "staging"
  region                = var.region
  vpc_cidr              = "10.21.0.0/16"
  domain_name           = var.domain_name
  route53_zone_id       = var.route53_zone_id
  github_repository_url = var.github_repository_url
  trigger_branch        = "staging"

  db_engine                = "sqlserver-ex"
  db_instance_class        = "db.t3.small"
  db_allocated_storage     = 20
  db_backup_retention_days = 7

  cpu           = 512
  memory        = 1024
  desired_count = 1
  autoscale_min = 1
  autoscale_max = 2
}

output "app_url" { value = module.stack.app_url }
output "db_address" { value = module.stack.db_address }
output "codebuild_project" { value = module.stack.codebuild_project }
