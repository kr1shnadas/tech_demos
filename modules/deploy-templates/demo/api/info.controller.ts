/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Controller, Get, Inject } from "@nestjs/common";
import { moduleVersion } from "../../src/credit.js";
import { DEPLOY_CONFIG, type DeployConfig } from "../../src/config/deploy-config.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#demo/api/info.controller.ts";

@Controller()
export class InfoController {
  constructor(@Inject(DEPLOY_CONFIG) private readonly config: DeployConfig) {}

  @Get("health")
  health() {
    return {
      status: "ok",
      service: this.config.serviceName,
    };
  }

  @Get(["version", "info"])
  version() {
    return {
      service: this.config.serviceName,
      version: moduleVersion,
      environment: this.config.environmentName,
      region: this.config.region,
      imageTag: this.config.imageTag,
      imageTagStrategy: this.config.imageTagStrategy,
      enableLambda: this.config.enableLambda,
      author: authorCredit.name,
      fingerprint: buildFingerprint,
    };
  }
}
