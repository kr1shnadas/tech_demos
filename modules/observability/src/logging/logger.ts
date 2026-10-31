/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { hostname } from "node:os";
import pino, { type DestinationStream, type Logger } from "pino";
import type { ObservabilityConfig } from "../config/observability-config.js";
import { currentCorrelation } from "./request-context.js";
import { redactFieldSet, redactValue } from "./redact.js";

export type AppLogger = Logger;

/** JSON logs. Each line carries the service name, and the request id and span ids when a request is active. */
export function createLogger(config: ObservabilityConfig, destination?: DestinationStream): AppLogger {
  const fields = redactFieldSet(config.logging.redactFields);
  return pino(
    {
      level: config.logging.enabled ? config.logging.level : "silent",
      base: {
        service: config.serviceName,
        pid: process.pid,
        hostname: hostname(),
      },
      messageKey: "msg",
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
        log(object) {
          const cleaned = redactValue(object, fields);
          const record = cleaned && typeof cleaned === "object" ? (cleaned as Record<string, unknown>) : {};
          return { ...record, ...currentCorrelation() };
        },
      },
    },
    destination ?? pino.destination({ sync: true }),
  );
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/logging/logger.ts";
