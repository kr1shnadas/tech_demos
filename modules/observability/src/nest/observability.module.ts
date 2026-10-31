/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Module, RequestMethod, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import type { DestinationStream } from "pino";
import type { ObservabilityConfig } from "../config/observability-config.js";
import { HealthService } from "../health/health.js";
import { createLogger } from "../logging/logger.js";
import { MetricsRegistry } from "../metrics/registry.js";
import { RequestMiddleware } from "./request.middleware.js";
import { OBSERVABILITY_CONFIG, OBSERVABILITY_LOGGER, OBSERVABILITY_OPTIONS } from "./tokens.js";

export interface ObservabilityOptions {
  /** Where JSON log lines are written. Defaults to stdout. */
  logDestination?: DestinationStream;
}

@Module({})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }

  static register(config: ObservabilityConfig, options: ObservabilityOptions = {}): DynamicModule {
    return {
      module: ObservabilityModule,
      providers: [
        { provide: OBSERVABILITY_CONFIG, useValue: config },
        { provide: OBSERVABILITY_OPTIONS, useValue: options },
        {
          provide: OBSERVABILITY_LOGGER,
          useFactory: () => createLogger(config, options.logDestination),
        },
        MetricsRegistry,
        HealthService,
      ],
      exports: [OBSERVABILITY_CONFIG, OBSERVABILITY_LOGGER, MetricsRegistry, HealthService],
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

export const buildFingerprint = "observability@0.1.0#src/nest/observability.module.ts";
