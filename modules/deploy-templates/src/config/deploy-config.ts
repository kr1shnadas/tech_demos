/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export const DEPLOY_CONFIG = "krishnadas.deploy-config";

export const imageTagStrategies = ["git-sha", "semver", "latest"] as const;

export type ImageTagStrategy = (typeof imageTagStrategies)[number];

/** Fargate only accepts these CPU and memory combinations. Memory is MiB. */
export function fargateMemoryForCpu(cpu: number): readonly number[] {
  if (cpu === 256) return [512, 1024, 2048];
  if (cpu === 512) return [1024, 2048, 3072, 4096];
  if (cpu === 1024) return range(2048, 8192, 1024);
  if (cpu === 2048) return range(4096, 16384, 1024);
  if (cpu === 4096) return range(8192, 30720, 1024);
  return [];
}

/**
 * One config object drives the service and the Terraform variables.
 * `pnpm tfvars` writes the `.tfvars` file from this shape.
 */
export interface DeployConfig {
  region: string;
  serviceName: string;
  containerPort: number;
  cpu: number;
  memory: number;
  desiredCount: number;
  environmentName: string;
  imageTagStrategy: ImageTagStrategy;
  /** Concrete tag the task definition pins. CI fills this from the strategy. */
  imageTag: string;
  /** Optional Lambda function that runs the same image. Off unless I ask for it. */
  enableLambda: boolean;
  lambdaMemory: number;
  lambdaTimeout: number;
  vpcCidr: string;
  availabilityZones: readonly [string, string];
  /** Private tasks plus a NAT gateway. Off by default because of the hourly charge. */
  enableNatGateway: boolean;
  /** Keep false until the load balancer should survive a destroy. */
  deletionProtection: boolean;
  /** Create the GitHub OIDC provider and the deploy role. */
  enableGithubOidc: boolean;
  githubOrg: string;
  githubRepo: string;
  /** Branch allowed to assume the deploy role. */
  githubBranch: string;
}

export const defaultDeployConfig: DeployConfig = Object.freeze({
  region: "us-east-1",
  serviceName: "deploy-demo",
  containerPort: 3000,
  cpu: 256,
  memory: 512,
  desiredCount: 1,
  environmentName: "dev",
  imageTagStrategy: "git-sha",
  imageTag: "local",
  enableLambda: false,
  lambdaMemory: 512,
  lambdaTimeout: 15,
  vpcCidr: "10.40.0.0/16",
  availabilityZones: Object.freeze(["us-east-1a", "us-east-1b"]) as unknown as readonly [string, string],
  enableNatGateway: false,
  deletionProtection: false,
  enableGithubOidc: false,
  githubOrg: "",
  githubRepo: "",
  githubBranch: "main",
});

export function defineDeployConfig(overrides: Partial<DeployConfig> = {}): DeployConfig {
  const provided = defined(overrides);
  const region = provided.region ?? defaultDeployConfig.region;
  const availabilityZones = provided.availabilityZones
    ? [...provided.availabilityZones]
    : provided.region
      ? [`${region}a`, `${region}b`]
      : [...defaultDeployConfig.availabilityZones];

  const merged: DeployConfig = {
    ...defaultDeployConfig,
    ...provided,
    availabilityZones: availabilityZones as unknown as readonly [string, string],
  };
  assertValid(merged);
  return {
    ...merged,
    availabilityZones: [availabilityZones[0] ?? "", availabilityZones[1] ?? ""],
  };
}

/**
 * Tag recorded on the image and pinned by the task definition.
 * `git-sha` and `semver` stay immutable in ECR. `latest` does not.
 */
export function resolveImageTag(
  strategy: ImageTagStrategy,
  source: { gitSha?: string; version?: string },
): string {
  if (strategy === "latest") return "latest";
  if (strategy === "semver") {
    const version = source.version?.trim().replace(/^v/, "");
    if (!version) throw new Error("semver tagging needs a version.");
    return version;
  }
  const sha = source.gitSha?.trim();
  if (!sha) throw new Error("git-sha tagging needs a commit sha.");
  return sha;
}

function defined(overrides: Partial<DeployConfig>): Partial<DeployConfig> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<DeployConfig>;
}

function assertValid(config: DeployConfig): void {
  assertSlug("serviceName", config.serviceName);
  assertSlug("environmentName", config.environmentName);
  const prefix = `${config.serviceName}-${config.environmentName}`;
  if (prefix.length > 24) {
    throw new Error(
      "serviceName and environmentName together must be 24 characters or fewer, so load balancer names fit.",
    );
  }
  if (!/^[a-z]{2}-[a-z]+-\d+$/.test(config.region)) {
    throw new Error("region must look like us-east-1.");
  }
  if (config.availabilityZones.length !== 2) {
    throw new Error("availabilityZones needs two zones.");
  }
  const zones = new Set<string>();
  for (const zone of config.availabilityZones) {
    const suffix = zone.slice(config.region.length);
    if (!zone.startsWith(config.region) || !/^[a-z]$/.test(suffix)) {
      throw new Error(`availability zone ${zone} does not belong to ${config.region}.`);
    }
    zones.add(zone);
  }
  if (zones.size !== 2) {
    throw new Error("availabilityZones must be two different zones.");
  }
  assertInt("containerPort", config.containerPort, 1, 65535);
  const allowedMemory = fargateMemoryForCpu(config.cpu);
  if (allowedMemory.length === 0) {
    throw new Error("cpu must be a Fargate size: 256, 512, 1024, 2048 or 4096.");
  }
  if (!allowedMemory.includes(config.memory)) {
    throw new Error(`memory ${config.memory} is not valid for ${config.cpu} CPU units.`);
  }
  assertInt("desiredCount", config.desiredCount, 0, 20);
  if (!imageTagStrategies.includes(config.imageTagStrategy)) {
    throw new Error("imageTagStrategy must be git-sha, semver or latest.");
  }
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(config.imageTag)) {
    throw new Error("imageTag must be a container tag.");
  }
  assertBoolean("enableLambda", config.enableLambda);
  assertInt("lambdaMemory", config.lambdaMemory, 128, 10240);
  assertInt("lambdaTimeout", config.lambdaTimeout, 1, 900);
  assertCidr(config.vpcCidr);
  assertBoolean("enableNatGateway", config.enableNatGateway);
  assertBoolean("deletionProtection", config.deletionProtection);
  assertBoolean("enableGithubOidc", config.enableGithubOidc);
  if (config.enableGithubOidc) {
    if (!/^[A-Za-z0-9_.-]{1,39}$/.test(config.githubOrg)) {
      throw new Error("githubOrg is required when enableGithubOidc is true.");
    }
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(config.githubRepo)) {
      throw new Error("githubRepo is required when enableGithubOidc is true.");
    }
    if (!/^[A-Za-z0-9._/-]{1,100}$/.test(config.githubBranch)) {
      throw new Error("githubBranch is required when enableGithubOidc is true.");
    }
  } else if (config.githubBranch !== "" && !/^[A-Za-z0-9._/-]{1,100}$/.test(config.githubBranch)) {
    throw new Error("githubBranch must be a branch name.");
  }
}

function assertSlug(name: string, value: string): void {
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(value)) {
    throw new Error(`${name} must be lower-case letters, digits and hyphens.`);
  }
}

function assertInt(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
}

function assertBoolean(name: string, value: unknown): void {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be true or false.`);
  }
}

function assertCidr(value: string): void {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(value);
  if (!match) throw new Error("vpcCidr must be an IPv4 CIDR.");
  const octets = [match[1], match[2], match[3], match[4]].map((part) => Number(part));
  const prefix = Number(match[5]);
  if (octets.some((octet) => octet > 255) || prefix < 16 || prefix > 20) {
    throw new Error("vpcCidr must be an IPv4 CIDR from /16 to /20.");
  }
}

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += step) values.push(value);
  return values;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#src/config/deploy-config.ts";
