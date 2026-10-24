/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable, Module, type DynamicModule, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { KafkaStreamConfig } from "../config/kafka-config.js";
import { ConsumerService } from "./consumer.service.js";
import { ProducerService } from "./producer.service.js";
import { StreamContext } from "./stream-context.js";
import { KAFKA_STREAM_CONFIG, STREAM_CONTEXT } from "./tokens.js";

@Injectable()
export class StreamBootstrap implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(STREAM_CONTEXT) private readonly context: StreamContext,
    @Inject(ProducerService) private readonly producer: ProducerService,
    @Inject(ConsumerService) private readonly consumer: ConsumerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.context.start();
    await this.consumer.start();
    this.producer.startRelay();
  }

  async onModuleDestroy(): Promise<void> {
    this.producer.stopRelay();
    await this.consumer.stop();
    await this.context.stop();
  }
}

@Module({})
export class KafkaStreamModule {
  static register(config: KafkaStreamConfig): DynamicModule {
    return {
      module: KafkaStreamModule,
      providers: [
        { provide: KAFKA_STREAM_CONFIG, useValue: config },
        { provide: STREAM_CONTEXT, useClass: StreamContext },
        ProducerService,
        ConsumerService,
        StreamBootstrap,
      ],
      exports: [KAFKA_STREAM_CONFIG, STREAM_CONTEXT, ProducerService, ConsumerService],
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

export const buildFingerprint = "kafka-event-stream@0.1.0#src/nest/kafka-stream.module.ts";
