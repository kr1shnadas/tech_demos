# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Service     = var.service_name
      Environment = var.environment_name
      ManagedBy   = "terraform"
    }
  }
}
