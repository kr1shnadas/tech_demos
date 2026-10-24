/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable } from "@nestjs/common";
import type { KafkaStreamConfig } from "../config/kafka-config.js";
import { enqueueInTransaction, publishPending, withTransaction, type EnqueueInput } from "../pipeline/outbox.js";
import type { StreamRecord } from "../pipeline/message.js";
import { STREAM_CONTEXT } from "./tokens.js";
import { StreamContext } from "./stream-context.js";

@Injectable()
export class ProducerService {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private publishing = false;

  constructor(@Inject(STREAM_CONTEXT) private readonly context: StreamContext) {}

  get config(): KafkaStreamConfig {
    return this.context.config;
  }

  async ping(): Promise<void> {
    await this.context.pool.query("SELECT 1");
  }

  /** Writes the business row's event in the same transaction as the outbox row. */
  enqueue(input: EnqueueInput): Promise<StreamRecord> {
    return withTransaction(this.context.pool, (client) => enqueueInTransaction(client, this.config, input));
  }

  startRelay(): void {
    if (!this.stopped && this.timer) return;
    this.stopped = false;
    const tick = async (): Promise<void> => {
      if (this.stopped) return;
      if (!this.publishing) {
        this.publishing = true;
        try {
          await publishPending(this.context.pool, this.context.producer, this.config);
        } catch (error) {
          if (!this.stopped) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`outbox relay failed: ${message}`);
          }
        } finally {
          this.publishing = false;
        }
      }
      if (!this.stopped) {
        this.timer = setTimeout(() => {
          void tick();
        }, this.config.outbox.pollIntervalMs);
      }
    };
    void tick();
  }

  stopRelay(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
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

export const buildFingerprint = "kafka-event-stream@0.1.0#src/nest/producer.service.ts";
