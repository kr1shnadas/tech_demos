/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  defineDeployConfig,
  imageTagStrategies,
  type DeployConfig,
  type ImageTagStrategy,
} from "./deploy-config.js";

/**
 * Builds the config from the environment.
 * Unset variables keep the defaults in `defineDeployConfig`.
 */
export function loadDeployConfig(env: NodeJS.ProcessEnv = process.env): DeployConfig {
  const overrides: Partial<DeployConfig> = {};

  if (present(env.DEPLOY_REGION)) overrides.region = env.DEPLOY_REGION.trim();
  if (present(env.DEPLOY_SERVICE_NAME)) overrides.serviceName = env.DEPLOY_SERVICE_NAME.trim();
  if (present(env.DEPLOY_CONTAINER_PORT)) {
    overrides.containerPort = readInt("DEPLOY_CONTAINER_PORT", env.DEPLOY_CONTAINER_PORT);
  }
  if (present(env.DEPLOY_CPU)) overrides.cpu = readInt("DEPLOY_CPU", env.DEPLOY_CPU);
  if (present(env.DEPLOY_MEMORY)) overrides.memory = readInt("DEPLOY_MEMORY", env.DEPLOY_MEMORY);
  if (present(env.DEPLOY_DESIRED_COUNT)) {
    overrides.desiredCount = readInt("DEPLOY_DESIRED_COUNT", env.DEPLOY_DESIRED_COUNT);
  }
  if (present(env.DEPLOY_ENVIRONMENT)) overrides.environmentName = env.DEPLOY_ENVIRONMENT.trim();
  if (present(env.DEPLOY_IMAGE_TAG_STRATEGY)) {
    overrides.imageTagStrategy = readStrategy(env.DEPLOY_IMAGE_TAG_STRATEGY);
  }
  if (present(env.DEPLOY_ENABLE_LAMBDA)) {
    overrides.enableLambda = readBool("DEPLOY_ENABLE_LAMBDA", env.DEPLOY_ENABLE_LAMBDA);
  }
  if (present(env.DEPLOY_LAMBDA_MEMORY)) {
    overrides.lambdaMemory = readInt("DEPLOY_LAMBDA_MEMORY", env.DEPLOY_LAMBDA_MEMORY);
  }
  if (present(env.DEPLOY_LAMBDA_TIMEOUT)) {
    overrides.lambdaTimeout = readInt("DEPLOY_LAMBDA_TIMEOUT", env.DEPLOY_LAMBDA_TIMEOUT);
  }
  if (present(env.DEPLOY_VPC_CIDR)) overrides.vpcCidr = env.DEPLOY_VPC_CIDR.trim();
  if (present(env.DEPLOY_AVAILABILITY_ZONES)) {
    const zones = env.DEPLOY_AVAILABILITY_ZONES.split(",").map((zone) => zone.trim()).filter(Boolean);
    overrides.availabilityZones = zones as unknown as readonly [string, string];
  }
  if (present(env.DEPLOY_ENABLE_NAT_GATEWAY)) {
    overrides.enableNatGateway = readBool("DEPLOY_ENABLE_NAT_GATEWAY", env.DEPLOY_ENABLE_NAT_GATEWAY);
  }
  if (present(env.DEPLOY_DELETION_PROTECTION)) {
    overrides.deletionProtection = readBool("DEPLOY_DELETION_PROTECTION", env.DEPLOY_DELETION_PROTECTION);
  }
  if (present(env.DEPLOY_ENABLE_GITHUB_OIDC)) {
    overrides.enableGithubOidc = readBool("DEPLOY_ENABLE_GITHUB_OIDC", env.DEPLOY_ENABLE_GITHUB_OIDC);
  }
  if (present(env.DEPLOY_GITHUB_ORG)) overrides.githubOrg = env.DEPLOY_GITHUB_ORG.trim();
  if (present(env.DEPLOY_GITHUB_REPO)) overrides.githubRepo = env.DEPLOY_GITHUB_REPO.trim();
  if (present(env.DEPLOY_GITHUB_BRANCH)) overrides.githubBranch = env.DEPLOY_GITHUB_BRANCH.trim();

  const strategy = overrides.imageTagStrategy ?? "git-sha";
  if (present(env.DEPLOY_IMAGE_TAG)) {
    overrides.imageTag = env.DEPLOY_IMAGE_TAG.trim();
  } else if (strategy === "latest") {
    overrides.imageTag = "latest";
  } else if (strategy === "semver" && present(env.DEPLOY_VERSION)) {
    overrides.imageTag = env.DEPLOY_VERSION.trim().replace(/^v/, "");
  } else if (strategy === "git-sha" && present(env.GITHUB_SHA)) {
    overrides.imageTag = env.GITHUB_SHA.trim();
  }

  return defineDeployConfig(overrides);
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function readInt(name: string, raw: string): number {
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  return value;
}

function readBool(name: string, raw: string): boolean {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function readStrategy(raw: string): ImageTagStrategy {
  const value = raw.trim() as ImageTagStrategy;
  if (!imageTagStrategies.includes(value)) {
    throw new Error("DEPLOY_IMAGE_TAG_STRATEGY must be git-sha, semver or latest.");
  }
  return value;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#src/config/load-config.ts";
