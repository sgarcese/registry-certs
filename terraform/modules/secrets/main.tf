# One Secrets Manager secret per environment holding the app's secret env
# vars as a JSON map. Terraform creates it with placeholders; real values are
# set out-of-band (console/CLI) and never live in Terraform state.

variable "env" { type = string }

variable "secret_keys" {
  type        = list(string)
  description = "JSON keys the app expects in the secret"
  default = [
    "REGISTRY_DATA_DB_PASSWORD",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "POSTMARK_SERVER_API_TOKEN",
    "API_KEYS",
    "WEB_API_KEY",
    "FULFILLMENT_API_KEY",
    "CONTACTFORM_TOKEN",
    "ROLLBAR_ACCESS_TOKEN",
  ]
}

resource "aws_secretsmanager_secret" "app" {
  name = "registry-certs/${var.env}/app"
}

resource "aws_secretsmanager_secret_version" "placeholder" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({ for k in var.secret_keys : k => "CHANGE-ME" })

  lifecycle {
    # Real values are managed outside Terraform after creation.
    ignore_changes = [secret_string]
  }
}

output "secret_arn" { value = aws_secretsmanager_secret.app.arn }

# Convenience map for the ecs-app module's `secrets` input:
# env var name -> "arn:...:secret:registry-certs/env/app:KEY::"
output "task_secrets" {
  value = {
    for k in var.secret_keys :
    k => "${aws_secretsmanager_secret.app.arn}:${k}::"
  }
}
