/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Module, type DynamicModule } from "@nestjs/common";
import { loadTenantConfig, TenantIamModule, type TenantIamConfig } from "../../src/index.js";
import { AdminController } from "./admin.controller.js";
import { seedDemo } from "./seed.js";
import { DEMO_ISSUER, type DemoIssuer } from "./session.js";

@Module({})
export class AppModule {
  static register(issuer: DemoIssuer, config: TenantIamConfig = loadTenantConfig()): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TenantIamModule.register(config, {
          auth: { config: issuer.config, localJwks: issuer.localJwks },
          seed: seedDemo,
        }),
      ],
      controllers: [AdminController],
      providers: [{ provide: DEMO_ISSUER, useValue: issuer }],
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#demo/api/app.module.ts";
