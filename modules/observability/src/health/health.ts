/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Injectable } from "@nestjs/common";

export interface HealthCheckResult {
  ok: boolean;
}

export type HealthCheck = () => HealthCheckResult | Promise<HealthCheckResult>;

export interface ReadinessReport {
  status: "ok" | "unavailable";
  checks: { name: string; ok: boolean }[];
}

/**
 * Liveness means the process can answer.
 * Readiness runs the registered checks and answers 503 when any of them fail.
 * With no checks registered, the process is ready as soon as it is up.
 */
@Injectable()
export class HealthService {
  private readonly checks: { name: string; run: HealthCheck }[] = [];

  add(name: string, run: HealthCheck): void {
    this.checks.push({ name, run });
  }

  live(): { status: "ok" } {
    return { status: "ok" };
  }

  async ready(): Promise<ReadinessReport> {
    const checks: { name: string; ok: boolean }[] = [];
    for (const check of this.checks) {
      try {
        const result = await check.run();
        checks.push({ name: check.name, ok: result.ok });
      } catch {
        checks.push({ name: check.name, ok: false });
      }
    }
    const ok = checks.every((check) => check.ok);
    return { status: ok ? "ok" : "unavailable", checks };
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

export const buildFingerprint = "observability@0.1.0#src/health/health.ts";
