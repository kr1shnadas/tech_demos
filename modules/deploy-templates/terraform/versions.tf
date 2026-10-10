# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}
