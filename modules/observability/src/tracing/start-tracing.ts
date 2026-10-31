/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
  TracerProvider,
  type SpanExporter,
} from "@opentelemetry/sdk-trace";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { ObservabilityConfig } from "../config/observability-config.js";

export interface TracingHandle {
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TracingStartOptions {
  /** Replaces the OTLP exporter. Tests pass an in-memory exporter here. */
  exporter?: SpanExporter;
}

const noopHandle: TracingHandle = {
  async forceFlush() {},
  async shutdown() {},
};

let contextReady = false;
let active: TracingHandle | null = null;
let unregisterInstrumentations: (() => void) | null = null;

/**
 * Call this before the process starts listening.
 * Incoming HTTP requests and outgoing `http`, `https` and fetch calls are instrumented.
 * The W3C `traceparent` header carries the span to the next service.
 * A sampled parent keeps its children, so the decision made on the first hop covers the call.
 */
export function startTracing(config: ObservabilityConfig, options: TracingStartOptions = {}): TracingHandle {
  ensureContextManager();
  if (!config.tracing.enabled) return noopHandle;
  if (active) return active;

  const exporter = options.exporter ?? new OTLPTraceExporter({ url: config.tracing.exporterEndpoint });
  const processor = options.exporter
    ? new SimpleSpanProcessor({ exporter })
    : new BatchSpanProcessor({ exporter, scheduledDelayMillis: 1000 });

  const provider = new TracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(config.tracing.samplingRatio),
    }),
    spanProcessors: [processor],
  });

  trace.setGlobalTracerProvider(provider);
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  );

  unregisterInstrumentations = registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook(request) {
          return isQuietPath(request.url);
        },
        ignoreOutgoingRequestHook(request) {
          const path = typeof request.path === "string" ? request.path : "";
          return path.includes("/v1/traces");
        },
      }),
      new UndiciInstrumentation({
        ignoreRequestHook(request) {
          return request.path.includes("/v1/traces");
        },
      }),
    ],
  });

  active = {
    forceFlush: () => provider.forceFlush(),
    shutdown: async () => {
      unregisterInstrumentations?.();
      unregisterInstrumentations = null;
      await provider.shutdown();
      active = null;
    },
  };
  return active;
}

export async function shutdownTracing(): Promise<void> {
  if (active) await active.shutdown();
}

/** Lets `context.with` keep a span across an async call, including when tracing itself is off. */
export function ensureContextManager(): void {
  if (contextReady) return;
  const manager = new AsyncLocalStorageContextManager();
  manager.enable();
  context.setGlobalContextManager(manager);
  contextReady = true;
}

function isQuietPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? url;
  return path === "/metrics" || path === "/health/live" || path === "/health/ready";
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/tracing/start-tracing.ts";
