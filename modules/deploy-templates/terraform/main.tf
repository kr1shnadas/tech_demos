# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

locals {
  name_prefix          = "${var.service_name}-${var.environment_name}"
  image_tag_mutability = var.image_tag_strategy == "latest" ? "MUTABLE" : "IMMUTABLE"
}

module "vpc" {
  source = "./modules/vpc"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_nat_gateway = var.enable_nat_gateway
}

module "ecr" {
  source = "./modules/ecr"

  name_prefix          = local.name_prefix
  image_tag_mutability = local.image_tag_mutability
}

module "alb" {
  source = "./modules/alb"

  name_prefix         = local.name_prefix
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  container_port      = var.container_port
  deletion_protection = var.deletion_protection
}

module "ecs" {
  source = "./modules/ecs"

  name_prefix           = local.name_prefix
  service_name          = var.service_name
  region                = var.region
  environment_name      = var.environment_name
  image_tag_strategy    = var.image_tag_strategy
  image_uri             = module.ecr.repository_url
  image_tag             = var.image_tag
  container_port        = var.container_port
  cpu                   = var.cpu
  memory                = var.memory
  desired_count         = var.desired_count
  enable_lambda         = var.enable_lambda
  vpc_id                = module.vpc.vpc_id
  task_subnet_ids       = var.enable_nat_gateway ? module.vpc.private_subnet_ids : module.vpc.public_subnet_ids
  assign_public_ip      = !var.enable_nat_gateway
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_arn

  depends_on = [module.alb]
}

module "lambda" {
  count  = var.enable_lambda ? 1 : 0
  source = "./modules/lambda"

  name_prefix      = local.name_prefix
  service_name     = var.service_name
  environment_name = var.environment_name
  image_uri        = module.ecr.repository_url
  image_tag        = var.image_tag
  memory           = var.lambda_memory
  timeout          = var.lambda_timeout
}

module "github_oidc" {
  count  = var.enable_github_oidc ? 1 : 0
  source = "./modules/github-oidc"

  name_prefix   = local.name_prefix
  github_org    = var.github_org
  github_repo   = var.github_repo
  github_branch = var.github_branch
}
