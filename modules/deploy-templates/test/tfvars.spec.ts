/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultDeployConfig, defineDeployConfig } from "../src/config/deploy-config.js";
import { formatHcl, tfvarKeys, toTfvars, writeTfvars } from "../src/config/write-tfvars.js";

const root = path.resolve(import.meta.dirname, "..");
const scratch: string[] = [];

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("tfvars mapping", () => {
  it("writes every root Terraform variable from the default config", () => {
    const text = toTfvars(defaultDeployConfig);
    expect(text).toContain("SPDX-License-Identifier: Apache-2.0");
    expect(text).toContain("Copyright 2026 Krishna Das");
    expect(text).toContain("NOTICE");
    expect(text).toMatch(/^region\s+= "us-east-1"$/m);
    expect(text).toMatch(/^service_name\s+= "deploy-demo"$/m);
    expect(text).toMatch(/^container_port\s+= 3000$/m);
    expect(text).toMatch(/^cpu\s+= 256$/m);
    expect(text).toMatch(/^memory\s+= 512$/m);
    expect(text).toMatch(/^desired_count\s+= 1$/m);
    expect(text).toMatch(/^environment_name\s+= "dev"$/m);
    expect(text).toMatch(/^image_tag_strategy\s+= "git-sha"$/m);
    expect(text).toMatch(/^image_tag\s+= "local"$/m);
    expect(text).toMatch(/^enable_lambda\s+= false$/m);
    expect(text).toMatch(/^lambda_memory\s+= 512$/m);
    expect(text).toMatch(/^lambda_timeout\s+= 15$/m);
    expect(text).toMatch(/^vpc_cidr\s+= "10\.40\.0\.0\/16"$/m);
    expect(text).toMatch(/^availability_zones\s+= \["us-east-1a", "us-east-1b"\]$/m);
    expect(text).toMatch(/^enable_nat_gateway\s+= false$/m);
    expect(text).toMatch(/^deletion_protection\s+= false$/m);
    expect(text).toMatch(/^enable_github_oidc\s+= false$/m);
    expect(text).toMatch(/^github_org\s+= ""$/m);
    expect(text).toMatch(/^github_repo\s+= ""$/m);
    expect(text).toMatch(/^github_branch\s+= "main"$/m);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("matches the variable names declared for the root module", () => {
    const variables = readFileSync(path.join(root, "terraform/variables.tf"), "utf8");
    const declared = [...variables.matchAll(/^variable "([a-z0-9_]+)"/gm)].map((match) => match[1]);
    expect(declared).toEqual([...tfvarKeys]);
    const written = [...toTfvars(defaultDeployConfig).matchAll(/^([a-z0-9_]+)\s+=/gm)].map((match) => match[1]);
    expect(written).toEqual([...tfvarKeys]);
  });

  it("flips the Lambda switch and the image tag in the file", () => {
    const text = toTfvars(
      defineDeployConfig({
        enableLambda: true,
        imageTagStrategy: "semver",
        imageTag: "0.1.0",
        enableNatGateway: true,
        region: "eu-west-1",
      }),
    );
    expect(text).toMatch(/^enable_lambda\s+= true$/m);
    expect(text).toMatch(/^image_tag_strategy\s+= "semver"$/m);
    expect(text).toMatch(/^image_tag\s+= "0\.1\.0"$/m);
    expect(text).toMatch(/^enable_nat_gateway\s+= true$/m);
    expect(text).toMatch(/^region\s+= "eu-west-1"$/m);
    expect(text).toMatch(/^availability_zones\s+= \["eu-west-1a", "eu-west-1b"\]$/m);
  });

  it("quotes strings and leaves numbers and booleans bare", () => {
    expect(formatHcl('say "hi"\\')).toBe('"say \\"hi\\"\\\\"');
    expect(formatHcl(512)).toBe("512");
    expect(formatHcl(false)).toBe("false");
    expect(formatHcl(true)).toBe("true");
    expect(formatHcl(["us-east-1a", "us-east-1b"])).toBe('["us-east-1a", "us-east-1b"]');
  });

  it("writes the same text to disk", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "deploy-tfvars-"));
    scratch.push(dir);
    const file = path.join(dir, "terraform.tfvars");
    writeTfvars(defaultDeployConfig, file);
    expect(readFileSync(file, "utf8")).toBe(toTfvars(defaultDeployConfig));
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

export const buildFingerprint = "deploy-templates@0.1.0#test/tfvars.spec.ts";
