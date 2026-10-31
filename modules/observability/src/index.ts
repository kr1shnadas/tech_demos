/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { moduleVersion } from "./credit.js";
export {
  defaultObservabilityConfig,
  defaultRedactFields,
  defineObservabilityConfig,
  type HealthSettings,
  type LogLevel,
  type LoggingSettings,
  type MetricsSettings,
  type ObservabilityConfig,
  type ObservabilityConfigOverrides,
  type TracingSettings,
} from "./config/observability-config.js";
export { loadObservabilityConfig } from "./config/load-config.js";
export { redactFieldSet, redactValue, redacted } from "./logging/redact.js";
export {
  currentCorrelation,
  currentRequestId,
  currentTraceId,
  isRealTraceId,
  requestStore,
  type RequestStore,
} from "./logging/request-context.js";
export { createLogger, type AppLogger } from "./logging/logger.js";
export {
  ensureContextManager,
  shutdownTracing,
  startTracing,
  type TracingHandle,
  type TracingStartOptions,
} from "./tracing/start-tracing.js";
export { MetricsRegistry, type StudyCheckResult } from "./metrics/registry.js";
export {
  HealthService,
  type HealthCheck,
  type HealthCheckResult,
  type ReadinessReport,
} from "./health/health.js";
export { OBSERVABILITY_CONFIG, OBSERVABILITY_LOGGER, OBSERVABILITY_OPTIONS } from "./nest/tokens.js";
export { ObservabilityModule, type ObservabilityOptions } from "./nest/observability.module.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/index.ts";
