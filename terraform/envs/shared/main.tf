# Account-shared resources: the ECR repository (one repo, per-env tags).

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
    key            = "registry-certs/shared/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "registry-certs-terraform-lock"
    encrypt        = true
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "registry-certs"
      ManagedBy = "terraform"
    }
  }
}

module "ecr" {
  source = "../../modules/ecr"
}

output "ecr_repository_url" { value = module.ecr.repository_url }
