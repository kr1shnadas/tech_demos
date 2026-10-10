# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.
#
# The CI workflow copies this file to terraform/backend.tf before init.
# Local validate and test leave the backend on disk so they need no bucket.
# Init with -backend-config for bucket, key, region and use_lockfile.

terraform {
  backend "s3" {}
}
