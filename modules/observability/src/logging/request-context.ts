/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { context, trace } from "@opentelemetry/api";

const emptyTraceId = "00000000000000000000000000000000";

export interface RequestStore {
  requestId: string;
  traceId?: string;
  spanId?: string;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

export function isRealTraceId(traceId: string | undefined): traceId is string {
  return typeof traceId === "string" && /^[0-9a-f]{32}$/.test(traceId) && traceId !== emptyTraceId;
}

/** Request id from the active request, plus the active span when one is present. */
export function currentCorrelation(): Record<string, string> {
  const store = requestStore.getStore();
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();
  const fields: Record<string, string> = {};
  if (store?.requestId) fields.requestId = store.requestId;
  const traceId = spanContext && isRealTraceId(spanContext.traceId) ? spanContext.traceId : store?.traceId;
  const spanId = spanContext && isRealTraceId(spanContext.traceId) ? spanContext.spanId : store?.spanId;
  if (traceId && spanId && isRealTraceId(traceId) && /^[0-9a-f]{16}$/.test(spanId)) {
    fields.traceId = traceId;
    fields.spanId = spanId;
  }
  return fields;
}

export function currentRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

export function currentTraceId(): string | undefined {
  return currentCorrelation().traceId;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/logging/request-context.ts";
