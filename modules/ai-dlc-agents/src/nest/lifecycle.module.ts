/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Module, RequestMethod, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import type { KitConfig } from "../config/kit-config.js";
import type { ModelProvider } from "../provider/types.js";
import { WorkflowOrchestrator, type OrchestratorOptions } from "../runtime/orchestrator.js";
import { HealthMiddleware } from "./health.middleware.js";
import { RunsController } from "./runs.controller.js";
import { KIT_CONFIG, ORCHESTRATOR } from "./tokens.js";

export interface LifecycleModuleOptions {
  config: KitConfig;
  provider?: ModelProvider;
  env?: NodeJS.ProcessEnv;
  orchestrator?: WorkflowOrchestrator;
}

@Module({})
export class LifecycleModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HealthMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }

  static register(options: LifecycleModuleOptions): DynamicModule {
    const orchestrator = options.orchestrator ?? orchestratorFrom(options);
    return {
      module: LifecycleModule,
      controllers: [RunsController],
      providers: [
        { provide: KIT_CONFIG, useValue: options.config },
        { provide: ORCHESTRATOR, useValue: orchestrator },
        HealthMiddleware,
      ],
      exports: [KIT_CONFIG, ORCHESTRATOR],
    };
  }
}

function orchestratorFrom(options: LifecycleModuleOptions): WorkflowOrchestrator {
  const env = options.env ?? process.env;
  const settings: OrchestratorOptions = {
    config: options.config,
    env,
  };
  if (options.provider) settings.provider = options.provider;
  return new WorkflowOrchestrator(settings);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/nest/lifecycle.module.ts";
