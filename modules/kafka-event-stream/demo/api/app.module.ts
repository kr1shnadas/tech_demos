/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Module, type DynamicModule } from "@nestjs/common";
import { KafkaStreamModule, loadKafkaConfig, type KafkaStreamConfig } from "../../src/index.js";
import { EventsController } from "./events.controller.js";

@Module({})
export class AppModule {
  static register(config: KafkaStreamConfig = loadKafkaConfig()): DynamicModule {
    return {
      module: AppModule,
      imports: [KafkaStreamModule.register(config)],
      controllers: [EventsController],
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

export const buildFingerprint = "kafka-event-stream@0.1.0#demo/api/app.module.ts";
