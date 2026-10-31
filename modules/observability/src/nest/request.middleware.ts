/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { context, trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";
import type { ObservabilityConfig } from "../config/observability-config.js";
import { HealthService } from "../health/health.js";
import type { AppLogger } from "../logging/logger.js";
import { isRealTraceId, requestStore, type RequestStore } from "../logging/request-context.js";
import { MetricsRegistry } from "../metrics/registry.js";
import { OBSERVABILITY_CONFIG, OBSERVABILITY_LOGGER } from "./tokens.js";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,80}$/;

@Injectable()
export class RequestMiddleware implements NestMiddleware {
  constructor(
    @Inject(OBSERVABILITY_CONFIG) private readonly config: ObservabilityConfig,
    @Inject(OBSERVABILITY_LOGGER) private readonly logger: AppLogger,
    @Inject(MetricsRegistry) private readonly metrics: MetricsRegistry,
    @Inject(HealthService) private readonly health: HealthService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.path || "/";
    if (path === this.config.health.livenessPath) {
      res.status(200).json(this.health.live());
      return;
    }
    if (path === this.config.health.readinessPath) {
      void this.health.ready().then((body) => {
        if (res.headersSent) return;
        res.status(body.status === "ok" ? 200 : 503).json(body);
      });
      return;
    }
    if (this.config.metrics.enabled && path === this.config.metrics.path) {
      void this.metrics.scrape().then((body) => {
        if (res.headersSent) return;
        res.status(200).set("content-type", this.metrics.contentType()).send(body);
      });
      return;
    }

    const incoming = req.header("x-request-id");
    const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
    res.setHeader("x-request-id", requestId);
    const store = captureStore(requestId);
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      if (!path.startsWith("/api")) return;
      const elapsedNs = Number(process.hrtime.bigint() - start);
      const status = res.statusCode;
      const route = routeOf(req);
      if (this.config.metrics.enabled) {
        this.metrics.observeHttp(req.method, route, status, elapsedNs / 1e9);
      }
      if (!this.config.logging.enabled) return;
      const fields = {
        method: req.method,
        route,
        status,
        durationMs: Math.round(elapsedNs / 1e6),
      };
      requestStore.run(store, () => {
        if (status >= 500) this.logger.error(fields, "request failed");
        else this.logger.info(fields, "request");
      });
    });
    requestStore.run(store, () => next());
  }
}

function captureStore(requestId: string): RequestStore {
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();
  const store: RequestStore = { requestId };
  if (spanContext && isRealTraceId(spanContext.traceId)) {
    store.traceId = spanContext.traceId;
    store.spanId = spanContext.spanId;
  }
  return store;
}

function routeOf(req: Request): string {
  const pattern = req.route?.path;
  if (typeof pattern === "string" && pattern.length > 0) {
    if (pattern.startsWith("/")) return pattern;
    const base = req.baseUrl ?? "";
    return `${base}/${pattern}`.replaceAll(/\/{2,}/g, "/");
  }
  return req.path || "/";
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/nest/request.middleware.ts";
