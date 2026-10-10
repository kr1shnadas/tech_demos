/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { writeFileSync } from "node:fs";
import type { DeployConfig } from "./deploy-config.js";

export type HclValue = string | number | boolean | readonly string[];

/** Renders one HCL literal. Strings are quoted. Lists stay on one line. */
export function formatHcl(value: HclValue): string {
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("HCL numbers must be finite.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `[${value.map((item) => formatHcl(item)).join(", ")}]`;
}

/**
 * Terraform variables for this config.
 * The file is the input to `terraform plan` and `terraform apply`.
 */
export function toTfvars(config: DeployConfig): string {
  const fields: Array<[string, HclValue]> = [
    ["region", config.region],
    ["service_name", config.serviceName],
    ["container_port", config.containerPort],
    ["cpu", config.cpu],
    ["memory", config.memory],
    ["desired_count", config.desiredCount],
    ["environment_name", config.environmentName],
    ["image_tag_strategy", config.imageTagStrategy],
    ["image_tag", config.imageTag],
    ["enable_lambda", config.enableLambda],
    ["lambda_memory", config.lambdaMemory],
    ["lambda_timeout", config.lambdaTimeout],
    ["vpc_cidr", config.vpcCidr],
    ["availability_zones", config.availabilityZones],
    ["enable_nat_gateway", config.enableNatGateway],
    ["deletion_protection", config.deletionProtection],
    ["enable_github_oidc", config.enableGithubOidc],
    ["github_org", config.githubOrg],
    ["github_repo", config.githubRepo],
    ["github_branch", config.githubBranch],
  ];
  const width = Math.max(...fields.map(([key]) => key.length));
  const body = fields.map(([key, value]) => `${key.padEnd(width)} = ${formatHcl(value)}`).join("\n");
  return [
    "# SPDX-License-Identifier: Apache-2.0",
    "# Copyright 2026 Krishna Das",
    "# See NOTICE at the repository root.",
    "# Written from the deploy config. Edit the config, then run pnpm tfvars.",
    "",
    body,
    "",
  ].join("\n");
}

export function writeTfvars(config: DeployConfig, filePath: string): void {
  writeFileSync(filePath, toTfvars(config));
}

export const tfvarKeys = [
  "region",
  "service_name",
  "container_port",
  "cpu",
  "memory",
  "desired_count",
  "environment_name",
  "image_tag_strategy",
  "image_tag",
  "enable_lambda",
  "lambda_memory",
  "lambda_timeout",
  "vpc_cidr",
  "availability_zones",
  "enable_nat_gateway",
  "deletion_protection",
  "enable_github_oidc",
  "github_org",
  "github_repo",
  "github_branch",
] as const;

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#src/config/write-tfvars.ts";
