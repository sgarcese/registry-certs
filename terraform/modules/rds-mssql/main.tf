# RDS SQL Server. Express edition for dev/staging (free license tier, 10GB/db
# cap — fine for stub data); Web edition for prod. Note: Multi-AZ requires
# Standard/Enterprise, so prod-on-Web is single-AZ with automated backups; if
# real production later needs HA, budget Standard edition.

variable "env" { type = string }
variable "vpc_id" { type = string }
variable "db_subnet_ids" { type = list(string) }

variable "engine" {
  type        = string
  description = "sqlserver-ex (Express) or sqlserver-web (Web)"
  default     = "sqlserver-ex"
}

variable "instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "backup_retention_days" {
  type    = number
  default = 1
}

variable "ingress_security_group_ids" {
  type        = list(string)
  description = "Security groups allowed to reach 1433 (app tasks, CodeBuild)"
}

resource "aws_security_group" "db" {
  name_prefix = "registry-certs-${var.env}-db-"
  vpc_id      = var.vpc_id

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

resource "aws_security_group_rule" "db_ingress" {
  count                    = length(var.ingress_security_group_ids)
  type                     = "ingress"
  from_port                = 1433
  to_port                  = 1433
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = var.ingress_security_group_ids[count.index]
}

resource "aws_db_subnet_group" "main" {
  name       = "registry-certs-${var.env}"
  subnet_ids = var.db_subnet_ids
}

resource "aws_db_instance" "main" {
  identifier     = "registry-certs-${var.env}"
  engine         = var.engine
  engine_version = "16.00"
  license_model  = "license-included"

  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  username = "rcadmin"
  # RDS generates and stores the master password in Secrets Manager; the
  # migration step reads it from there. No password in Terraform state.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.env == "prod"
  skip_final_snapshot       = var.env != "prod"
  final_snapshot_identifier = var.env == "prod" ? "registry-certs-prod-final" : null

  apply_immediately = var.env != "prod"
}

output "db_address" { value = aws_db_instance.main.address }
output "db_security_group_id" { value = aws_security_group.db.id }
output "master_user_secret_arn" {
  value = aws_db_instance.main.master_user_secret[0].secret_arn
}
