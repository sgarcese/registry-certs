# Shared ECR repository (one repo; per-env image tags: :dev, :staging, :prod,
# plus immutable :<git-sha> tags).

resource "aws_ecr_repository" "main" {
  name                 = "registry-certs"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "main" {
  repository = aws_ecr_repository.main.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the most recent 30 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = { type = "expire" }
      }
    ]
  })
}

output "repository_url" { value = aws_ecr_repository.main.repository_url }
output "repository_arn" { value = aws_ecr_repository.main.arn }
output "repository_name" { value = aws_ecr_repository.main.name }
