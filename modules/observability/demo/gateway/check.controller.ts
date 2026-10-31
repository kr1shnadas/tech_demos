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
  HttpException,
  Inject,
  Query,
} from "@nestjs/common";
import {
  OBSERVABILITY_LOGGER,
  currentRequestId,
  currentTraceId,
  type AppLogger,
} from "../../src/index.js";
import { callCatalog, catalogBaseUrl } from "./catalog.js";

type Mode = "ok" | "slow" | "fail";

@Controller("api")
export class CheckController {
  constructor(@Inject(OBSERVABILITY_LOGGER) private readonly logger: AppLogger) {}

  @Get("checks")
  async check(@Query("mode") mode: string | undefined): Promise<Record<string, unknown>> {
    const kind = readMode(mode);
    const requestId = currentRequestId() ?? "";
    const traceId = currentTraceId();
    const started = Date.now();
    let result: { status: number; body: string };
    try {
      result = await callCatalog(`${catalogBaseUrl()}/api/work?mode=${kind}`, requestId);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The catalog call failed.";
      this.logger.error({ mode: kind, err: message }, "catalog call failed");
      throw new HttpException({ mode: kind, status: 502, requestId, traceId, message }, 502);
    }
    const durationMs = Date.now() - started;
    if (result.status >= 400) {
      throw new HttpException(
        {
          mode: kind,
          status: result.status,
          requestId,
          traceId,
          durationMs,
          message: "The catalog returned an error.",
        },
        result.status,
      );
    }
    let catalog: unknown = result.body;
    try {
      catalog = JSON.parse(result.body) as unknown;
    } catch {
      catalog = result.body;
    }
    return { mode: kind, status: result.status, requestId, traceId, durationMs, catalog };
  }
}

function readMode(mode: string | undefined): Mode {
  if (mode === undefined || mode === "" || mode === "ok") return "ok";
  if (mode === "slow" || mode === "fail") return mode;
  throw new BadRequestException("mode must be ok, slow or fail.");
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#demo/gateway/check.controller.ts";
