/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
} from "@nestjs/common";
import {
  IDEMPOTENCY_STORE,
  JOBS_RUNTIME,
  JobNotFoundError,
  UnknownJobError,
  UnrecoverableJobError,
  assertFeedSync,
  assertImportBatch,
  assertNotice,
  releaseFeed,
  type FeedSync,
  type IdempotencyStore,
  type ImportBatch,
  type IngestionJobs,
  type JobRuntime,
  type Notice,
  type NotificationJobs,
} from "../../src/index.js";
import { sampleBatch, sampleDigest, sampleFeed, sampleNotice } from "./samples.js";

interface RetryBody {
  deadLetterId?: string;
  queue?: string;
  jobId?: string;
}

@Controller("api/demo")
export class DemoController {
  constructor(
    @Inject(JOBS_RUNTIME) private readonly runtime: JobRuntime,
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
  ) {}

  @Post("import")
  @HttpCode(201)
  async import(@Body() body: unknown): Promise<{ id: string; queue: string; name: string }> {
    return this.guard(async () => {
      const delayMs = readDelay(body);
      const batch = readBatch(body) ?? sampleBatch();
      assertImportBatch(batch);
      const queued = await this.runtime.producer<IngestionJobs>("ingestion").add("import-batch", batch, {
        idempotencyKey: batch.batchId,
        delayMs,
      });
      return { id: queued.id, queue: queued.queue, name: queued.name };
    });
  }

  @Post("notice")
  @HttpCode(201)
  async notice(@Body() body: unknown): Promise<{ id: string; queue: string; name: string }> {
    return this.guard(async () => {
      const notice = readNotice(body) ?? sampleNotice();
      assertNotice(notice);
      const queued = await this.runtime.producer<NotificationJobs>("notification").add("send-notice", notice, {
        idempotencyKey: notice.messageId,
      });
      return { id: queued.id, queue: queued.queue, name: queued.name };
    });
  }

  @Post("sync")
  @HttpCode(201)
  async sync(@Body() body: unknown): Promise<{ id: string; queue: string; name: string }> {
    return this.guard(async () => {
      const feed = readFeed(body);
      assertFeedSync(feed);
      const queued = await this.runtime.producer<IngestionJobs>("ingestion").add("sync-feed", feed, {
        idempotencyKey: feed.feedId,
      });
      return { id: queued.id, queue: queued.queue, name: queued.name };
    });
  }

  @Post("digest")
  @HttpCode(201)
  async digest(): Promise<{ key: string; queue: string; name: string }> {
    return this.guard(async () => {
      const digest = sampleDigest();
      const scheduled = await this.runtime.producer<NotificationJobs>("notification").schedule(
        "send-digest",
        digest,
        { key: "nightly-digest", pattern: "* * * * *" },
      );
      return { key: scheduled.key, queue: scheduled.queue, name: scheduled.name };
    });
  }

  @Post("retry")
  @HttpCode(200)
  async retry(@Body() body: RetryBody): Promise<{ id: string; queue: string; name: string }> {
    return this.guard(async () => {
      if (body?.deadLetterId) {
        const letters = (await this.runtime.snapshot()).deadLetter;
        const letter = letters.find((row) => row.id === body.deadLetterId);
        if (!letter) throw new JobNotFoundError("Dead letter not found.");
        if (letter.jobName === "sync-feed") await releaseFeed(this.store, letter.subject);
        const queued = await this.runtime.retryDeadLetter(body.deadLetterId);
        return queued;
      }
      if (body?.queue && body.jobId) {
        const job = await this.runtime.getJob(body.queue, body.jobId);
        if (!job) throw new JobNotFoundError(`Job ${body.jobId} was not found on ${body.queue}.`);
        if (job.name === "sync-feed") {
          const data = job.data as Partial<FeedSync>;
          if (typeof data.feedId === "string") await releaseFeed(this.store, data.feedId);
        }
        await this.runtime.retryFailed(body.queue, body.jobId);
        return { id: body.jobId, queue: body.queue, name: job.name };
      }
      throw new BadRequestException("Provide deadLetterId, or queue and jobId.");
    });
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      if (error instanceof JobNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof UnknownJobError || error instanceof UnrecoverableJobError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

function readDelay(body: unknown): number | undefined {
  if (!body || typeof body !== "object" || !("delayMs" in body)) return undefined;
  const value = (body as { delayMs?: unknown }).delayMs;
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 86_400_000) {
    throw new BadRequestException("delayMs must be an integer from 0 to 86400000.");
  }
  return value;
}

function readBatch(body: unknown): ImportBatch | undefined {
  if (!body || typeof body !== "object" || !("batch" in body)) return undefined;
  const batch = (body as { batch?: unknown }).batch;
  if (!batch) return undefined;
  return batch as ImportBatch;
}

function readNotice(body: unknown): Notice | undefined {
  if (!body || typeof body !== "object" || !("notice" in body)) return undefined;
  const notice = (body as { notice?: unknown }).notice;
  if (!notice) return undefined;
  return notice as Notice;
}

function readFeed(body: unknown): FeedSync {
  const outcome = body && typeof body === "object" && "outcome" in body
    ? (body as { outcome?: unknown }).outcome
    : undefined;
  if (outcome === "transient" || outcome === "outage" || outcome === "ok") return sampleFeed(outcome);
  if (body && typeof body === "object" && "feed" in body && (body as { feed?: unknown }).feed) {
    return (body as { feed: FeedSync }).feed;
  }
  throw new BadRequestException("outcome must be transient, outage or ok.");
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#demo/api/demo.controller.ts";
