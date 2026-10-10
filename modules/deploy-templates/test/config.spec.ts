/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import {
  defaultDeployConfig,
  defineDeployConfig,
  fargateMemoryForCpu,
  resolveImageTag,
} from "../src/config/deploy-config.js";
import { loadDeployConfig } from "../src/config/load-config.js";

describe("deploy config", () => {
  it("starts from the defaults I use for a local demo", () => {
    expect(defineDeployConfig()).toEqual(defaultDeployConfig);
    expect(defineDeployConfig().region).toBe("us-east-1");
    expect(defineDeployConfig().serviceName).toBe("deploy-demo");
    expect(defineDeployConfig().containerPort).toBe(3000);
    expect(defineDeployConfig().cpu).toBe(256);
    expect(defineDeployConfig().memory).toBe(512);
    expect(defineDeployConfig().desiredCount).toBe(1);
    expect(defineDeployConfig().environmentName).toBe("dev");
    expect(defineDeployConfig().imageTagStrategy).toBe("git-sha");
    expect(defineDeployConfig().imageTag).toBe("local");
    expect(defineDeployConfig().enableLambda).toBe(false);
    expect(defineDeployConfig().enableNatGateway).toBe(false);
  });

  it("derives availability zones when only the region changes", () => {
    const config = defineDeployConfig({ region: "eu-west-1", serviceName: "study-api" });
    expect(config.availabilityZones).toEqual(["eu-west-1a", "eu-west-1b"]);
    expect(config.serviceName).toBe("study-api");
    expect(config.containerPort).toBe(3000);
  });

  it("keeps zones I set, as long as they belong to the region", () => {
    const config = defineDeployConfig({
      region: "eu-west-1",
      availabilityZones: ["eu-west-1a", "eu-west-1c"],
    });
    expect(config.availabilityZones).toEqual(["eu-west-1a", "eu-west-1c"]);
  });

  it("rejects a Fargate size AWS will not run", () => {
    expect(() => defineDeployConfig({ cpu: 256, memory: 4096 })).toThrow(/memory 4096/);
    expect(() => defineDeployConfig({ cpu: 300, memory: 512 })).toThrow(/Fargate size/);
    expect(fargateMemoryForCpu(256)).toEqual([512, 1024, 2048]);
    expect(fargateMemoryForCpu(4096)).toContain(30720);
    expect(fargateMemoryForCpu(4096)).not.toContain(31744);
    expect(fargateMemoryForCpu(1024)).toContain(8192);
    expect(fargateMemoryForCpu(1024)).not.toContain(9216);
  });

  it("rejects names, ports and strategies that would break the stack", () => {
    expect(() => defineDeployConfig({ serviceName: "Deploy" })).toThrow(/serviceName/);
    expect(() => defineDeployConfig({ containerPort: 0 })).toThrow(/containerPort/);
    expect(() => defineDeployConfig({ containerPort: 1.5 })).toThrow(/containerPort/);
    expect(() => defineDeployConfig({ desiredCount: -1 })).toThrow(/desiredCount/);
    expect(() => defineDeployConfig({ region: "us-east" })).toThrow(/region/);
    expect(() => defineDeployConfig({ imageTagStrategy: "floating" as "git-sha" })).toThrow(/imageTagStrategy/);
    expect(() => defineDeployConfig({ imageTag: "has space" })).toThrow(/imageTag/);
    expect(() => defineDeployConfig({ availabilityZones: ["us-east-1a"] as unknown as readonly [string, string] })).toThrow(
      /two zones/,
    );
    expect(() =>
      defineDeployConfig({ availabilityZones: ["us-east-1a", "eu-west-1b"] }),
    ).toThrow(/does not belong/);
    expect(() => defineDeployConfig({ vpcCidr: "10.40.0.0/8" })).toThrow(/vpcCidr/);
  });

  it("requires a GitHub org and repo only when the OIDC switch is on", () => {
    expect(defineDeployConfig({ enableGithubOidc: false }).githubOrg).toBe("");
    expect(() => defineDeployConfig({ enableGithubOidc: true })).toThrow(/githubOrg/);
    const config = defineDeployConfig({
      enableGithubOidc: true,
      githubOrg: "kr1shnadas",
      githubRepo: "tech_demos",
    });
    expect(config.githubBranch).toBe("main");
    expect(config.enableLambda).toBe(false);
  });

  it("turns the Lambda path on without changing the Fargate defaults", () => {
    const config = defineDeployConfig({ enableLambda: true, lambdaMemory: 1024, lambdaTimeout: 30 });
    expect(config.enableLambda).toBe(true);
    expect(config.lambdaMemory).toBe(1024);
    expect(config.lambdaTimeout).toBe(30);
    expect(config.desiredCount).toBe(1);
    expect(() => defineDeployConfig({ lambdaTimeout: 0 })).toThrow(/lambdaTimeout/);
  });

  it("resolves an immutable tag from a sha or a version", () => {
    expect(resolveImageTag("git-sha", { gitSha: "abc123" })).toBe("abc123");
    expect(resolveImageTag("semver", { version: "v0.1.0" })).toBe("0.1.0");
    expect(resolveImageTag("latest", {})).toBe("latest");
    expect(() => resolveImageTag("git-sha", {})).toThrow(/commit sha/);
    expect(() => resolveImageTag("semver", {})).toThrow(/version/);
  });

  it("reads overrides from the environment and ignores a blank value", () => {
    expect(loadDeployConfig({})).toEqual(defaultDeployConfig);
    const config = loadDeployConfig({
      DEPLOY_REGION: "ap-southeast-2",
      DEPLOY_SERVICE_NAME: "study-api",
      DEPLOY_CONTAINER_PORT: "8080",
      DEPLOY_CPU: "512",
      DEPLOY_MEMORY: "1024",
      DEPLOY_DESIRED_COUNT: "2",
      DEPLOY_ENVIRONMENT: "staging",
      DEPLOY_IMAGE_TAG_STRATEGY: "semver",
      DEPLOY_VERSION: "v1.4.0",
      DEPLOY_ENABLE_LAMBDA: "true",
      DEPLOY_ENABLE_NAT_GATEWAY: "false",
    });
    expect(config.region).toBe("ap-southeast-2");
    expect(config.availabilityZones).toEqual(["ap-southeast-2a", "ap-southeast-2b"]);
    expect(config.serviceName).toBe("study-api");
    expect(config.containerPort).toBe(8080);
    expect(config.cpu).toBe(512);
    expect(config.memory).toBe(1024);
    expect(config.desiredCount).toBe(2);
    expect(config.environmentName).toBe("staging");
    expect(config.imageTagStrategy).toBe("semver");
    expect(config.imageTag).toBe("1.4.0");
    expect(config.enableLambda).toBe(true);
    expect(config.enableNatGateway).toBe(false);
  });

  it("lets an explicit image tag win over the sha, and rejects a bad boolean", () => {
    const config = loadDeployConfig({
      DEPLOY_IMAGE_TAG: "local",
      GITHUB_SHA: "abc123def",
    });
    expect(config.imageTag).toBe("local");
    expect(loadDeployConfig({ GITHUB_SHA: "abc123def" }).imageTag).toBe("abc123def");
    expect(loadDeployConfig({ DEPLOY_IMAGE_TAG_STRATEGY: "latest" }).imageTag).toBe("latest");
    expect(() => loadDeployConfig({ DEPLOY_ENABLE_LAMBDA: "yes" })).toThrow(/DEPLOY_ENABLE_LAMBDA/);
    expect(() => loadDeployConfig({ DEPLOY_CPU: "nope" })).toThrow(/DEPLOY_CPU/);
  });
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#test/config.spec.ts";
