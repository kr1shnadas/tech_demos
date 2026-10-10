/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { DynamicModule, Module } from "@nestjs/common";
import { DEPLOY_CONFIG, type DeployConfig } from "../../src/config/deploy-config.js";
import { loadDeployConfig } from "../../src/config/load-config.js";
import { InfoController } from "./info.controller.js";

@Module({})
export class AppModule {
  static register(config: DeployConfig = loadDeployConfig()): DynamicModule {
    return {
      module: AppModule,
      controllers: [InfoController],
      providers: [{ provide: DEPLOY_CONFIG, useValue: config }],
    };
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#demo/api/app.module.ts";
