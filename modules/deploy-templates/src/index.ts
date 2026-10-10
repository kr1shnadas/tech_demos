/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { moduleVersion } from "./credit.js";
export {
  DEPLOY_CONFIG,
  defaultDeployConfig,
  defineDeployConfig,
  fargateMemoryForCpu,
  imageTagStrategies,
  resolveImageTag,
  type DeployConfig,
  type ImageTagStrategy,
} from "./config/deploy-config.js";
export { loadDeployConfig } from "./config/load-config.js";
export { toTfvars, writeTfvars, type HclValue } from "./config/write-tfvars.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#src/index.ts";
