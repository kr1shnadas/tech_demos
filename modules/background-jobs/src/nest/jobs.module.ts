/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import {
  Inject,
  Injectable,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { JobsConfig } from "../config/jobs-config.js";
import type { Closable } from "../queue/idempotency.js";
import { JobRuntime, type QueueRegistration } from "../queue/runtime.js";
import { HealthMiddleware } from "./health.middleware.js";
import { JOBS_CLOSABLES, JOBS_CONFIG, JOBS_RUNTIME } from "./tokens.js";

export interface JobsModuleOptions {
  config: JobsConfig;
  queues: QueueRegistration[];
  /** Closed after the workers, in order. Use this for the idempotency Redis client. */
  closables?: Closable[];
}

@Injectable()
class JobsLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(JOBS_RUNTIME) private readonly runtime: JobRuntime,
    @Inject(JOBS_CLOSABLES) private readonly closables: Closable[],
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.runtime.close();
    for (const closable of this.closables) await closable.close();
  }
}

@Module({})
export class JobsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HealthMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }

  static register(options: JobsModuleOptions): DynamicModule {
    return {
      module: JobsModule,
      providers: [
        { provide: JOBS_CONFIG, useValue: options.config },
        {
          provide: JOBS_RUNTIME,
          useFactory: () => JobRuntime.open(options.config, options.queues),
        },
        { provide: JOBS_CLOSABLES, useValue: options.closables ?? [] },
        HealthMiddleware,
        JobsLifecycle,
      ],
      exports: [JOBS_CONFIG, JOBS_RUNTIME],
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

export const buildFingerprint = "background-jobs@0.1.0#src/nest/jobs.module.ts";
