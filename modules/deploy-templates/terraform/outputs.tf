# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

output "name_prefix" {
  description = "service-environment prefix used on resource names."
  value       = local.name_prefix
}

output "ecr_repository_url" {
  description = "Push the image here."
  value       = module.ecr.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name."
  value       = module.ecr.repository_name
}

output "image_tag_mutability" {
  description = "IMMUTABLE for git-sha and semver. MUTABLE for latest."
  value       = module.ecr.image_tag_mutability
}

output "load_balancer_dns" {
  description = "Public DNS name of the load balancer."
  value       = module.alb.dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.ecs.service_name
}

output "lambda_function_name" {
  description = "Set when enable_lambda is true."
  value       = one(module.lambda[*].function_name)
}

output "deploy_role_arn" {
  description = "Set when enable_github_oidc is true."
  value       = one(module.github_oidc[*].role_arn)
}

output "public_subnet_count" {
  description = "Public subnets created for the load balancer."
  value       = module.vpc.public_subnet_count
}
