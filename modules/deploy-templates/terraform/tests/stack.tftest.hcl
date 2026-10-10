# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"ecs-tasks.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}"
    }
  }
}

variables {
  region             = "us-east-1"
  service_name       = "deploy-demo"
  container_port     = 3000
  cpu                = 256
  memory             = 512
  desired_count      = 1
  environment_name   = "dev"
  image_tag_strategy = "git-sha"
  image_tag          = "local"
  enable_lambda      = false
  enable_nat_gateway = false
  enable_github_oidc = false
}

run "fargate_without_lambda" {
  command = plan

  assert {
    condition     = output.name_prefix == "deploy-demo-dev"
    error_message = "Resource names should join the service and the environment."
  }

  assert {
    condition     = output.image_tag_mutability == "IMMUTABLE"
    error_message = "A git-sha tag should be immutable."
  }

  assert {
    condition     = output.public_subnet_count == 2
    error_message = "The load balancer needs two public subnets."
  }

  assert {
    condition     = length(module.lambda) == 0
    error_message = "The Lambda module stays out until the switch is on."
  }

  assert {
    condition     = length(module.github_oidc) == 0
    error_message = "The OIDC role stays out until the switch is on."
  }
}

run "lambda_and_oidc" {
  command = plan

  variables {
    enable_lambda      = true
    enable_github_oidc = true
    github_org         = "kr1shnadas"
    github_repo        = "tech_demos"
    github_branch      = "main"
  }

  assert {
    condition     = length(module.lambda) == 1
    error_message = "The Lambda module should be created when the switch is on."
  }

  assert {
    condition     = module.lambda[0].function_name == "deploy-demo-dev"
    error_message = "The Lambda function should use the service prefix."
  }

  assert {
    condition     = length(module.github_oidc) == 1
    error_message = "The OIDC module should be created when the switch is on."
  }
}

run "mutable_latest_tag" {
  command = plan

  variables {
    image_tag_strategy = "latest"
    image_tag          = "latest"
  }

  assert {
    condition     = output.image_tag_mutability == "MUTABLE"
    error_message = "The latest strategy should allow a moving tag."
  }
}
