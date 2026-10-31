/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultObservabilityConfig, defineObservabilityConfig } from "../src/config/observability-config.js";
import { loadObservabilityConfig } from "../src/config/load-config.js";

describe("observability config", () => {
  it("starts from the local demo defaults", () => {
    const config = defineObservabilityConfig();
    expect(config.serviceName).toBe("observability");
    expect(config.tracing).toEqual(defaultObservabilityConfig.tracing);
    expect(config.logging.level).toBe("info");
    expect(config.logging.redactFields).toContain("password");
    expect(config.metrics.path).toBe("/metrics");
    expect(config.health.livenessPath).toBe("/health/live");
    expect(config.health.readinessPath).toBe("/health/ready");
  });

  it("merges a nested override without dropping the other fields", () => {
    const config = defineObservabilityConfig({
      serviceName: "study-gateway",
      tracing: { samplingRatio: 0.2 },
      logging: { level: "debug" },
    });
    expect(config.serviceName).toBe("study-gateway");
    expect(config.tracing.samplingRatio).toBe(0.2);
    expect(config.tracing.enabled).toBe(true);
    expect(config.tracing.exporterEndpoint).toBe(defaultObservabilityConfig.tracing.exporterEndpoint);
    expect(config.logging.level).toBe("debug");
    expect(config.logging.redactFields).toEqual(defaultObservabilityConfig.logging.redactFields);
    expect(config.metrics.enabled).toBe(true);
  });

  it("reads the environment", () => {
    const config = loadObservabilityConfig({
      O11Y_SERVICE_NAME: "study-catalog",
      O11Y_TRACING_ENABLED: "false",
      O11Y_EXPORTER_ENDPOINT: "http://collector:4318/v1/traces",
      O11Y_SAMPLING_RATIO: "0.25",
      O11Y_LOG_LEVEL: "warn",
      O11Y_LOGGING_ENABLED: "true",
      O11Y_REDACT_FIELDS: "password, token",
      O11Y_METRICS_ENABLED: "0",
      O11Y_METRICS_PATH: "/prom",
      O11Y_LIVENESS_PATH: "/live",
      O11Y_READINESS_PATH: "/ready",
    });
    expect(config.serviceName).toBe("study-catalog");
    expect(config.tracing.enabled).toBe(false);
    expect(config.tracing.exporterEndpoint).toBe("http://collector:4318/v1/traces");
    expect(config.tracing.samplingRatio).toBe(0.25);
    expect(config.logging.level).toBe("warn");
    expect(config.logging.redactFields).toEqual(["password", "token"]);
    expect(config.metrics.enabled).toBe(false);
    expect(config.metrics.path).toBe("/prom");
    expect(config.health).toEqual({ livenessPath: "/live", readinessPath: "/ready" });
  });

  it("rejects a sampling ratio outside 0 to 1", () => {
    expect(() => defineObservabilityConfig({ tracing: { samplingRatio: 1.5 } })).toThrow(/0 to 1/);
  });

  it("rejects a metrics path that collides with health", () => {
    expect(() => defineObservabilityConfig({ metrics: { path: "/health/live" } })).toThrow(/distinct/);
  });

  it("ships a high error rate rule and a p95 latency rule", () => {
    const rules = readFileSync(path.resolve(import.meta.dirname, "../deploy/prometheus/alerts.yml"), "utf8");
    expect(rules).toContain("alert: HighErrorRate");
    expect(rules).toContain("http_errors_total");
    expect(rules).toContain("alert: HighP95Latency");
    expect(rules).toContain("histogram_quantile");
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

export const buildFingerprint = "observability@0.1.0#test/config.spec.ts";
