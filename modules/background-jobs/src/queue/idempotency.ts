/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Redis } from "ioredis";
import type { JobsConfig } from "../config/jobs-config.js";
import { commandConnection } from "./options.js";

export interface Closable {
  close(): Promise<void>;
}

/**
 * Records a key after a handler finishes.
 * A second delivery of the same key can return without doing the work again.
 * A crash before the mark still runs the handler, so the work itself has to
 * tolerate a second apply.
 */
export interface IdempotencyStore extends Closable {
  has(key: string): Promise<boolean>;
  mark(key: string): Promise<void>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly keys = new Set<string>();

  async has(key: string): Promise<boolean> {
    return this.keys.has(key);
  }

  async mark(key: string): Promise<void> {
    this.keys.add(key);
  }

  async close(): Promise<void> {}
}

export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private closed = false;

  constructor(config: JobsConfig, private readonly ttlSeconds = 60 * 60 * 24 * 7) {
    this.prefix = `${config.prefix}:done:`;
    this.redis = new Redis(commandConnection(config));
  }

  async has(key: string): Promise<boolean> {
    const found = await this.redis.exists(this.storageKey(key));
    return found === 1;
  }

  async mark(key: string): Promise<void> {
    await this.redis.set(this.storageKey(key), "1", "EX", this.ttlSeconds);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.redis.quit();
  }

  private storageKey(key: string): string {
    return this.prefix + key;
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

export const buildFingerprint = "background-jobs@0.1.0#src/queue/idempotency.ts";
