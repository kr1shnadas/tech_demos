/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import type { ObservabilityConfig } from "../config/observability-config.js";
import { OBSERVABILITY_CONFIG } from "../nest/tokens.js";

export type StudyCheckResult = "ok" | "slow" | "error";

const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Prometheus registry for one process.
 * HTTP counters and the latency histogram are recorded by the request hook.
 * `study_checks_total` is the business counter the catalog demo increments.
 */
@Injectable()
export class MetricsRegistry {
  readonly register = new Registry();
  private readonly enabled: boolean;
  private readonly httpRequests: Counter<"method" | "route" | "status"> | null;
  private readonly httpErrors: Counter<"method" | "route" | "status"> | null;
  private readonly httpDuration: Histogram<"method" | "route"> | null;
  private readonly studyChecks: Counter<"result"> | null;

  constructor(@Inject(OBSERVABILITY_CONFIG) config: ObservabilityConfig) {
    this.enabled = config.metrics.enabled;
    this.register.setDefaultLabels({ service: config.serviceName });
    if (!this.enabled) {
      this.httpRequests = null;
      this.httpErrors = null;
      this.httpDuration = null;
      this.studyChecks = null;
      return;
    }
    collectDefaultMetrics({ register: this.register });
    this.httpRequests = new Counter({
      name: "http_requests_total",
      help: "HTTP requests handled by this service",
      labelNames: ["method", "route", "status"],
      registers: [this.register],
    });
    this.httpErrors = new Counter({
      name: "http_errors_total",
      help: "HTTP requests that finished with status 500 or higher",
      labelNames: ["method", "route", "status"],
      registers: [this.register],
    });
    this.httpDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route"],
      buckets: durationBuckets,
      registers: [this.register],
    });
    this.studyChecks = new Counter({
      name: "study_checks_total",
      help: "Study checks finished by the catalog, labelled by result",
      labelNames: ["result"],
      registers: [this.register],
    });
  }

  observeHttp(method: string, route: string, status: number, durationSeconds: number): void {
    if (!this.httpRequests || !this.httpDuration || !this.httpErrors) return;
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe({ method, route }, durationSeconds);
    if (status >= 500) this.httpErrors.inc(labels);
  }

  recordStudyCheck(result: StudyCheckResult): void {
    this.studyChecks?.inc({ result });
  }

  contentType(): string {
    return this.register.contentType;
  }

  scrape(): Promise<string> {
    if (!this.enabled) return Promise.resolve("");
    return this.register.metrics();
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

export const buildFingerprint = "observability@0.1.0#src/metrics/registry.ts";
