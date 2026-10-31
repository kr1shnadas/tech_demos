/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Inject, Injectable, Module, type DynamicModule, type OnModuleInit } from "@nestjs/common";
import {
  HealthService,
  ObservabilityModule,
  loadObservabilityConfig,
  type ObservabilityConfig,
} from "../../src/index.js";
import { CheckController } from "./check.controller.js";
import { callCatalog, catalogBaseUrl } from "./catalog.js";

@Injectable()
class CatalogReady implements OnModuleInit {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  onModuleInit(): void {
    const base = catalogBaseUrl();
    this.health.add("catalog", async () => {
      try {
        const result = await callCatalog(`${base}/health/live`, "ready-check");
        return { ok: result.status === 200 };
      } catch {
        return { ok: false };
      }
    });
  }
}

@Module({})
export class AppModule {
  static register(config: ObservabilityConfig = loadObservabilityConfig()): DynamicModule {
    return {
      module: AppModule,
      imports: [ObservabilityModule.register(config)],
      controllers: [CheckController],
      providers: [CatalogReady],
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

export const buildFingerprint = "observability@0.1.0#demo/gateway/app.module.ts";
