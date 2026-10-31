/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export interface TracingSettings {
  /** When false, no exporter is started and HTTP calls are not instrumented. */
  enabled: boolean;
  /** OTLP HTTP endpoint, including the `/v1/traces` path. */
  exporterEndpoint: string;
  /** Fraction of root spans to keep, from 0 to 1. Child spans follow the parent. */
  samplingRatio: number;
}

export interface LoggingSettings {
  enabled: boolean;
  level: LogLevel;
  /** Object keys replaced in log lines. Matching is case-insensitive. */
  redactFields: readonly string[];
}

export interface MetricsSettings {
  enabled: boolean;
  /** Prometheus scrape path. */
  path: string;
}

export interface HealthSettings {
  livenessPath: string;
  readinessPath: string;
}

/**
 * One object drives tracing, logging, metrics and health.
 * Defaults target the Docker Compose demo.
 */
export interface ObservabilityConfig {
  serviceName: string;
  serviceVersion: string;
  tracing: TracingSettings;
  logging: LoggingSettings;
  metrics: MetricsSettings;
  health: HealthSettings;
}

export interface ObservabilityConfigOverrides {
  serviceName?: string;
  serviceVersion?: string;
  tracing?: Partial<TracingSettings>;
  logging?: Partial<LoggingSettings>;
  metrics?: Partial<MetricsSettings>;
  health?: Partial<HealthSettings>;
}

const logLevels: readonly LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

export const defaultRedactFields: readonly string[] = Object.freeze([
  "password",
  "authorization",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "cookie",
  "set-cookie",
]);

export const defaultObservabilityConfig: ObservabilityConfig = Object.freeze({
  serviceName: "observability",
  serviceVersion: "0.1.0",
  tracing: Object.freeze({
    enabled: true,
    exporterEndpoint: "http://localhost:4318/v1/traces",
    samplingRatio: 1,
  }),
  logging: Object.freeze({
    enabled: true,
    level: "info" as const,
    redactFields: defaultRedactFields,
  }),
  metrics: Object.freeze({
    enabled: true,
    path: "/metrics",
  }),
  health: Object.freeze({
    livenessPath: "/health/live",
    readinessPath: "/health/ready",
  }),
});

export function defineObservabilityConfig(overrides: ObservabilityConfigOverrides = {}): ObservabilityConfig {
  const loggingOverrides = defined(overrides.logging ?? {});
  const merged: ObservabilityConfig = {
    serviceName: overrides.serviceName ?? defaultObservabilityConfig.serviceName,
    serviceVersion: overrides.serviceVersion ?? defaultObservabilityConfig.serviceVersion,
    tracing: { ...defaultObservabilityConfig.tracing, ...defined(overrides.tracing ?? {}) },
    logging: {
      ...defaultObservabilityConfig.logging,
      ...loggingOverrides,
      redactFields: loggingOverrides.redactFields
        ? [...loggingOverrides.redactFields]
        : [...defaultObservabilityConfig.logging.redactFields],
    },
    metrics: { ...defaultObservabilityConfig.metrics, ...defined(overrides.metrics ?? {}) },
    health: { ...defaultObservabilityConfig.health, ...defined(overrides.health ?? {}) },
  };
  assertObservabilityConfig(merged);
  return merged;
}

export function assertObservabilityConfig(config: ObservabilityConfig): void {
  if (!config.serviceName.trim() || config.serviceName.length > 80) {
    throw new Error("serviceName must be 1 to 80 characters.");
  }
  if (/[\u0000-\u001f]/.test(config.serviceName)) {
    throw new Error("serviceName must not contain control characters.");
  }
  if (!config.serviceVersion.trim() || config.serviceVersion.length > 40) {
    throw new Error("serviceVersion must be 1 to 40 characters.");
  }
  if (!Number.isFinite(config.tracing.samplingRatio) || config.tracing.samplingRatio < 0 || config.tracing.samplingRatio > 1) {
    throw new Error("tracing.samplingRatio must be a number from 0 to 1.");
  }
  assertHttpUrl(config.tracing.exporterEndpoint, "tracing.exporterEndpoint");
  if (!logLevels.includes(config.logging.level)) {
    throw new Error("logging.level must be fatal, error, warn, info, debug, trace or silent.");
  }
  if (config.logging.redactFields.length > 40) {
    throw new Error("logging.redactFields must list at most 40 names.");
  }
  for (const field of config.logging.redactFields) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(field)) {
      throw new Error(`redact field "${field}" must be letters, digits, "_" or "-".`);
    }
  }
  assertPath(config.metrics.path, "metrics.path");
  assertPath(config.health.livenessPath, "health.livenessPath");
  assertPath(config.health.readinessPath, "health.readinessPath");
  const paths = [config.metrics.path, config.health.livenessPath, config.health.readinessPath];
  if (new Set(paths).size !== paths.length) {
    throw new Error("metrics and health paths must be distinct.");
  }
}

function assertHttpUrl(value: string, label: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an http(s) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must be an http(s) URL.`);
  }
}

function assertPath(value: string, label: string): void {
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(value) || value.length > 80) {
    throw new Error(`${label} must be a path starting with /.`);
  }
}

function defined<T extends object>(overrides: T): Partial<T> {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/config/observability-config.ts";
