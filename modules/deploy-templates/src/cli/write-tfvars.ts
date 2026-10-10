/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadDeployConfig } from "../config/load-config.js";
import { toTfvars } from "../config/write-tfvars.js";
import { writeFileSync } from "node:fs";

const requested = process.argv[2];
const out = requested
  ? path.resolve(requested)
  : path.resolve(import.meta.dirname, "../../terraform/terraform.tfvars");

writeFileSync(out, toTfvars(loadDeployConfig()));

try {
  execFileSync("terraform", ["fmt", out], { stdio: "ignore" });
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== "ENOENT") throw error;
}

console.log(out);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#src/cli/write-tfvars.ts";
