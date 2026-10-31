/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defineObservabilityConfig } from "../src/config/observability-config.js";
import { MetricsRegistry } from "../src/metrics/registry.js";

describe("metrics", () => {
  it("counts requests, errors, latency and study checks", async () => {
    const registry = new MetricsRegistry(defineObservabilityConfig({ serviceName: "metrics-test" }));
    registry.observeHttp("GET", "/api/checks", 200, 0.02);
    registry.observeHttp("GET", "/api/checks", 500, 0.9);
    registry.recordStudyCheck("ok");
    registry.recordStudyCheck("error");
    const text = await registry.scrape();
    expect(text).toContain('service="metrics-test"');
    expect(text).toContain("http_requests_total");
    expect(text).toContain('status="200"');
    expect(text).toContain('status="500"');
    expect(text).toContain("http_request_duration_seconds_bucket");
    expect(text).toContain("http_errors_total");
    expect(text).toMatch(/http_errors_total\{[^}]*status="500"[^}]*\} 1/);
    expect(text).toContain("study_checks_total");
    expect(text).toContain('result="ok"');
    expect(text).toContain('result="error"');
  });

  it("stays quiet when metrics are off", async () => {
    const registry = new MetricsRegistry(
      defineObservabilityConfig({ serviceName: "quiet", metrics: { enabled: false } }),
    );
    registry.observeHttp("GET", "/api/checks", 500, 1);
    registry.recordStudyCheck("error");
    const text = await registry.scrape();
    expect(text).not.toContain("http_requests_total");
    expect(text).not.toContain("study_checks_total");
  });
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#test/metrics.spec.ts";
