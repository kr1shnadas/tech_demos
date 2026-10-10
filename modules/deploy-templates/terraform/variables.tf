# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

variable "region" {
  type        = string
  description = "AWS region for every resource."
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]+$", var.region))
    error_message = "region must look like us-east-1."
  }
}

variable "service_name" {
  type        = string
  description = "Short name used in resource names."
  default     = "deploy-demo"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.service_name))
    error_message = "service_name must be lower-case letters, digits and hyphens."
  }
}

variable "container_port" {
  type        = number
  description = "Port the container listens on."
  default     = 3000

  validation {
    condition     = var.container_port >= 1 && var.container_port <= 65535
    error_message = "container_port must be between 1 and 65535."
  }
}

variable "cpu" {
  type        = number
  description = "Fargate CPU units."
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu)
    error_message = "cpu must be 256, 512, 1024, 2048 or 4096."
  }
}

variable "memory" {
  type        = number
  description = "Fargate memory in MiB. Must be a size AWS accepts for cpu."
  default     = 512

  validation {
    condition = (
      (var.cpu == 256 && contains([512, 1024, 2048], var.memory)) ||
      (var.cpu == 512 && contains([1024, 2048, 3072, 4096], var.memory)) ||
      (var.cpu == 1024 && var.memory >= 2048 && var.memory <= 8192 && var.memory % 1024 == 0) ||
      (var.cpu == 2048 && var.memory >= 4096 && var.memory <= 16384 && var.memory % 1024 == 0) ||
      (var.cpu == 4096 && var.memory >= 8192 && var.memory <= 30720 && var.memory % 1024 == 0)
    )
    error_message = "memory is not a valid Fargate size for the given cpu."
  }
}

variable "desired_count" {
  type        = number
  description = "Number of running tasks. Zero stops the tasks and leaves the service."
  default     = 1

  validation {
    condition     = var.desired_count >= 0 && var.desired_count <= 20 && floor(var.desired_count) == var.desired_count
    error_message = "desired_count must be a whole number from 0 to 20."
  }
}

variable "environment_name" {
  type        = string
  description = "Environment appended to resource names."
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.environment_name))
    error_message = "environment_name must be lower-case letters, digits and hyphens."
  }
}

variable "image_tag_strategy" {
  type        = string
  description = "git-sha and semver are immutable tags. latest is mutable."
  default     = "git-sha"

  validation {
    condition     = contains(["git-sha", "semver", "latest"], var.image_tag_strategy)
    error_message = "image_tag_strategy must be git-sha, semver or latest."
  }
}

variable "image_tag" {
  type        = string
  description = "Tag the task definition pins."
  default     = "local"

  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$", var.image_tag))
    error_message = "image_tag must be a container tag."
  }
}

variable "enable_lambda" {
  type        = bool
  description = "Also run the same image as a Lambda function."
  default     = false
}

variable "lambda_memory" {
  type        = number
  description = "Lambda memory in MB. Used only when enable_lambda is true."
  default     = 512

  validation {
    condition     = var.lambda_memory >= 128 && var.lambda_memory <= 10240
    error_message = "lambda_memory must be from 128 to 10240."
  }
}

variable "lambda_timeout" {
  type        = number
  description = "Lambda timeout in seconds. Used only when enable_lambda is true."
  default     = 15

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "lambda_timeout must be from 1 to 900."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR for the service VPC."
  default     = "10.40.0.0/16"

  validation {
    condition = (
      can(cidrhost(var.vpc_cidr, 0))
      && tonumber(split("/", var.vpc_cidr)[1]) >= 16
      && tonumber(split("/", var.vpc_cidr)[1]) <= 20
    )
    error_message = "vpc_cidr must be an IPv4 CIDR from /16 to /20."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "Two availability zones for the subnets."
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition = (
      length(var.availability_zones) == 2
      && alltrue([for zone in var.availability_zones : startswith(zone, var.region)])
    )
    error_message = "Provide exactly two availability zones in the selected region."
  }
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Place tasks on private subnets and open a NAT gateway."
  default     = false
}

variable "deletion_protection" {
  type        = bool
  description = "Protect the load balancer from destroy."
  default     = false
}

variable "enable_github_oidc" {
  type        = bool
  description = "Create the GitHub OIDC provider and the deploy role."
  default     = false
}

variable "github_org" {
  type        = string
  description = "GitHub organization allowed to assume the deploy role."
  default     = ""
}

variable "github_repo" {
  type        = string
  description = "GitHub repository allowed to assume the deploy role."
  default     = ""
}

variable "github_branch" {
  type        = string
  description = "Branch allowed to assume the deploy role."
  default     = "main"
}
