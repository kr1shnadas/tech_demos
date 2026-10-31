/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, readFileSync } from "node:fs";
import {
  defineObservabilityConfig,
  type LogLevel,
  type ObservabilityConfig,
  type ObservabilityConfigOverrides,
} from "./observability-config.js";

const logLevels = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

/**
 * Builds the config from the environment.
 * Unset variables keep the defaults in `defineObservabilityConfig`.
 * When this reads `process.env` and a `.env` file is present, values already
 * set in the environment win.
 */
export function loadObservabilityConfig(env: NodeJS.ProcessEnv = process.env): ObservabilityConfig {
  if (env === process.env) loadEnvFile();
  const overrides: ObservabilityConfigOverrides = {};

  if (present(env.O11Y_SERVICE_NAME)) overrides.serviceName = env.O11Y_SERVICE_NAME.trim();
  if (present(env.O11Y_SERVICE_VERSION)) overrides.serviceVersion = env.O11Y_SERVICE_VERSION.trim();

  const tracing: NonNullable<ObservabilityConfigOverrides["tracing"]> = {};
  if (present(env.O11Y_TRACING_ENABLED)) tracing.enabled = readBool("O11Y_TRACING_ENABLED", env.O11Y_TRACING_ENABLED);
  if (present(env.O11Y_EXPORTER_ENDPOINT)) tracing.exporterEndpoint = env.O11Y_EXPORTER_ENDPOINT.trim();
  if (present(env.O11Y_SAMPLING_RATIO)) tracing.samplingRatio = readNumber("O11Y_SAMPLING_RATIO", env.O11Y_SAMPLING_RATIO);
  if (Object.keys(tracing).length > 0) overrides.tracing = tracing;

  const logging: NonNullable<ObservabilityConfigOverrides["logging"]> = {};
  if (present(env.O11Y_LOGGING_ENABLED)) logging.enabled = readBool("O11Y_LOGGING_ENABLED", env.O11Y_LOGGING_ENABLED);
  if (present(env.O11Y_LOG_LEVEL)) logging.level = readLevel(env.O11Y_LOG_LEVEL);
  if (present(env.O11Y_REDACT_FIELDS)) {
    logging.redactFields = env.O11Y_REDACT_FIELDS.split(",").map((field) => field.trim()).filter(Boolean);
  }
  if (Object.keys(logging).length > 0) overrides.logging = logging;

  const metrics: NonNullable<ObservabilityConfigOverrides["metrics"]> = {};
  if (present(env.O11Y_METRICS_ENABLED)) metrics.enabled = readBool("O11Y_METRICS_ENABLED", env.O11Y_METRICS_ENABLED);
  if (present(env.O11Y_METRICS_PATH)) metrics.path = env.O11Y_METRICS_PATH.trim();
  if (Object.keys(metrics).length > 0) overrides.metrics = metrics;

  const health: NonNullable<ObservabilityConfigOverrides["health"]> = {};
  if (present(env.O11Y_LIVENESS_PATH)) health.livenessPath = env.O11Y_LIVENESS_PATH.trim();
  if (present(env.O11Y_READINESS_PATH)) health.readinessPath = env.O11Y_READINESS_PATH.trim();
  if (Object.keys(health).length > 0) overrides.health = health;

  return defineObservabilityConfig(overrides);
}

export function loadEnvFile(path = ".env"): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function readNumber(name: string, raw: string): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number.`);
  return value;
}

function readBool(name: string, raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`${name} must be true or false.`);
}

function readLevel(raw: string): LogLevel {
  const value = raw.trim().toLowerCase();
  if (!logLevels.has(value)) {
    throw new Error("O11Y_LOG_LEVEL must be fatal, error, warn, info, debug, trace or silent.");
  }
  return value as LogLevel;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/config/load-config.ts";
