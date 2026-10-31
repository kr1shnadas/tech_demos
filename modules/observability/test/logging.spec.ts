/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Writable } from "node:stream";
import { ROOT_CONTEXT, context, trace, TraceFlags } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { defineObservabilityConfig } from "../src/config/observability-config.js";
import { createLogger } from "../src/logging/logger.js";
import { redacted } from "../src/logging/redact.js";
import { requestStore } from "../src/logging/request-context.js";
import { ensureContextManager } from "../src/tracing/start-tracing.js";

describe("log correlation", () => {
  it("writes the request id, the span ids and a redacted field on one line", () => {
    ensureContextManager();
    const lines: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString("utf8"));
        callback();
      },
    });
    const logger = createLogger(
      defineObservabilityConfig({ serviceName: "log-test", tracing: { enabled: false } }),
      destination,
    );
    const spanContext = {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: TraceFlags.SAMPLED,
    };
    const ctx = trace.setSpanContext(ROOT_CONTEXT, spanContext);
    context.with(ctx, () => {
      requestStore.run({ requestId: "req-42" }, () => {
        logger.info({ password: "hunter2", user: "ada" }, "study check");
      });
    });
    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed.msg).toBe("study check");
    expect(parsed.level).toBe("info");
    expect(parsed.service).toBe("log-test");
    expect(parsed.requestId).toBe("req-42");
    expect(parsed.traceId).toBe(spanContext.traceId);
    expect(parsed.spanId).toBe(spanContext.spanId);
    expect(parsed.password).toBe(redacted);
    expect(parsed.user).toBe("ada");
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

export const buildFingerprint = "observability@0.1.0#test/logging.spec.ts";
