/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 *
 * Loaded before the HTTP server so incoming and outgoing calls are instrumented.
 */

import { loadObservabilityConfig } from "../../src/config/load-config.js";
import { startTracing } from "../../src/tracing/start-tracing.js";

export const observabilityConfig = loadObservabilityConfig();
export const tracing = startTracing(observabilityConfig);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#demo/gateway/instrument.ts";
