# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

variable "name_prefix" {
  type = string
}

variable "image_tag_mutability" {
  type = string
}

resource "aws_ecr_repository" "this" {
  name                 = var.name_prefix
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = true
  }

  lifecycle {
    precondition {
      condition     = length(var.name_prefix) <= 24
      error_message = "name_prefix must be 24 characters or fewer so the load balancer name fits."
    }
  }

  tags = {
    Name = var.name_prefix
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the last 20 images."
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "repository_arn" {
  value = aws_ecr_repository.this.arn
}

output "repository_name" {
  value = aws_ecr_repository.this.name
}

output "image_tag_mutability" {
  value = aws_ecr_repository.this.image_tag_mutability
}
