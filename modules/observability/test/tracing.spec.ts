/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createRequire } from "node:module";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SpanKind } from "@opentelemetry/api";
import { InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineObservabilityConfig } from "../src/config/observability-config.js";
import { startTracing, type TracingHandle } from "../src/tracing/start-tracing.js";

describe("trace propagation", () => {
  const exporter = new InMemorySpanExporter();
  const nodeRequire = createRequire(import.meta.url);
  let tracing: TracingHandle;
  let catalog: Server;
  let gateway: Server;
  let gatewayPort = 0;

  beforeAll(async () => {
    tracing = startTracing(
      defineObservabilityConfig({
        serviceName: "trace-test",
        tracing: { enabled: true, samplingRatio: 1 },
      }),
      { exporter },
    );
    const http = nodeRequire("node:http") as typeof import("node:http");
    catalog = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });
    const catalogPort = await listen(catalog);
    gateway = http.createServer((_req, res) => {
      const call = http.request(
        {
          hostname: "127.0.0.1",
          port: catalogPort,
          path: "/work",
          method: "GET",
        },
        (upstream) => {
          upstream.resume();
          upstream.on("end", () => {
            res.writeHead(upstream.statusCode ?? 200, { "content-type": "text/plain" });
            res.end("done");
          });
        },
      );
      call.on("error", () => {
        res.writeHead(502);
        res.end("down");
      });
      call.end();
    });
    gatewayPort = await listen(gateway);
  });

  afterAll(async () => {
    await close(gateway);
    await close(catalog);
    await tracing.shutdown();
  });

  it("keeps one trace from the caller through the outgoing call", async () => {
    await get(nodeRequire, `http://127.0.0.1:${gatewayPort}/checks`);
    await tracing.forceFlush();
    const spans = exporter.getFinishedSpans();
    const catalogServer = spans.find(
      (span) => span.kind === SpanKind.SERVER && pathOf(span).includes("/work"),
    );
    expect(catalogServer, JSON.stringify(spans.map(summary))).toBeTruthy();
    const parentId = catalogServer?.parentSpanContext?.spanId;
    const client = spans.find(
      (span) => span.kind === SpanKind.CLIENT && span.spanContext().spanId === parentId,
    );
    expect(client, JSON.stringify(spans.map(summary))).toBeTruthy();
    const gatewayServer = spans.find(
      (span) =>
        span.kind === SpanKind.SERVER &&
        span.spanContext().spanId === client?.parentSpanContext?.spanId &&
        pathOf(span).includes("/checks"),
    );
    expect(gatewayServer, JSON.stringify(spans.map(summary))).toBeTruthy();
    expect(catalogServer?.spanContext().traceId).toBe(gatewayServer?.spanContext().traceId);
    expect(client?.spanContext().traceId).toBe(gatewayServer?.spanContext().traceId);
  });
});

function pathOf(span: ReadableSpan): string {
  const path = span.attributes["url.path"] ?? span.attributes["http.target"] ?? "";
  return String(path);
}

function summary(span: ReadableSpan): { name: string; kind: SpanKind; path: string; parent?: string } {
  return {
    name: span.name,
    kind: span.kind,
    path: pathOf(span),
    parent: span.parentSpanContext?.spanId,
  };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function get(nodeRequire: NodeRequire, url: string): Promise<void> {
  const http = nodeRequire("node:http") as typeof import("node:http");
  return new Promise((resolve, reject) => {
    const req = http.request(url, (res) => {
      res.resume();
      res.on("end", () => resolve());
    });
    req.on("error", reject);
    req.end();
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#test/tracing.spec.ts";
