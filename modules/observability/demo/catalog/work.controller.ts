/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Query,
} from "@nestjs/common";
import {
  MetricsRegistry,
  OBSERVABILITY_CONFIG,
  OBSERVABILITY_LOGGER,
  type AppLogger,
  type ObservabilityConfig,
} from "../../src/index.js";

type Mode = "ok" | "slow" | "fail";

@Controller("api")
export class WorkController {
  constructor(
    @Inject(OBSERVABILITY_CONFIG) private readonly config: ObservabilityConfig,
    @Inject(OBSERVABILITY_LOGGER) private readonly logger: AppLogger,
    @Inject(MetricsRegistry) private readonly metrics: MetricsRegistry,
  ) {}

  @Get("work")
  async work(@Query("mode") mode: string | undefined): Promise<{
    result: "ok" | "slow";
    service: string;
    waitedMs: number;
  }> {
    const kind = readMode(mode);
    const waitedMs = kind === "slow" ? readSlowMs() : 0;
    if (waitedMs > 0) await delay(waitedMs);
    if (kind === "fail") {
      this.metrics.recordStudyCheck("error");
      this.logger.warn({ mode: kind }, "study check failed");
      throw new InternalServerErrorException("The study check failed.");
    }
    const result = kind === "slow" ? "slow" : "ok";
    this.metrics.recordStudyCheck(result);
    this.logger.info({ mode: kind, waitedMs }, "study check finished");
    return { result, service: this.config.serviceName, waitedMs };
  }
}

function readMode(mode: string | undefined): Mode {
  if (mode === undefined || mode === "" || mode === "ok") return "ok";
  if (mode === "slow" || mode === "fail") return mode;
  throw new BadRequestException("mode must be ok, slow or fail.");
}

function readSlowMs(): number {
  const raw = process.env.SLOW_MS?.trim() || "800";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new Error("SLOW_MS must be an integer from 0 to 10000.");
  }
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#demo/catalog/work.controller.ts";
