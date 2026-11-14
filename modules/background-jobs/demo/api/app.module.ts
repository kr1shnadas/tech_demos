/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Module, type DynamicModule } from "@nestjs/common";
import {
  IDEMPOTENCY_STORE,
  JobsModule,
  RedisIdempotencyStore,
  queueRegistrations,
  type JobsConfig,
} from "../../src/index.js";
import { BoardController } from "./board.controller.js";
import { DemoController } from "./demo.controller.js";
import { demoConfig } from "./pace.js";

@Module({})
export class AppModule {
  static register(config: JobsConfig = demoConfig()): DynamicModule {
    const store = new RedisIdempotencyStore(config);
    return {
      module: AppModule,
      imports: [
        JobsModule.register({
          config,
          queues: queueRegistrations(store),
          closables: [store],
        }),
      ],
      controllers: [BoardController, DemoController],
      providers: [{ provide: IDEMPOTENCY_STORE, useValue: store }],
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

export const buildFingerprint = "background-jobs@0.1.0#demo/api/app.module.ts";
