/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Writable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { defineObservabilityConfig } from "../src/config/observability-config.js";
import { HealthService } from "../src/health/health.js";
import { redacted } from "../src/logging/redact.js";
import { ObservabilityModule } from "../src/nest/observability.module.js";
import { ProbeController } from "./probe.controller.js";

describe("http surface", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
  });

  it("answers health, records the request and redacts the log line", async () => {
    const lines: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString("utf8"));
        callback();
      },
    });
    const config = defineObservabilityConfig({
      serviceName: "probe",
      tracing: { enabled: false },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.register(config, { logDestination: destination })],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const live = await request(app.getHttpServer()).get("/health/live").expect(200);
    expect(live.body).toEqual({ status: "ok" });

    const ready = await request(app.getHttpServer()).get("/health/ready").expect(200);
    expect(ready.body.status).toBe("ok");

    const ping = await request(app.getHttpServer()).get("/api/ping").expect(200);
    expect(ping.body).toEqual({ ok: true });
    const requestId = ping.headers["x-request-id"];
    expect(requestId).toEqual(expect.any(String));

    const metrics = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(metrics.text).toContain("http_requests_total");
    expect(metrics.text).toContain("/api/ping");
    expect(metrics.text).toContain('service="probe"');

    const pingLine = lines.map(parseLine).find((line) => line.msg === "ping");
    expect(pingLine?.requestId).toBe(requestId);
    expect(pingLine?.password).toBe(redacted);
    expect(pingLine?.note).toBe("hello");

    const requestLine = lines.map(parseLine).find((line) => line.msg === "request");
    expect(requestLine?.requestId).toBe(requestId);
    expect(requestLine?.route).toBe("/api/ping");
    expect(requestLine?.status).toBe(200);
  });

  it("reports unavailable when a readiness check fails", async () => {
    const config = defineObservabilityConfig({
      serviceName: "probe",
      tracing: { enabled: false },
      logging: { enabled: false },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.register(config)],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    app.get(HealthService).add("catalog", () => ({ ok: false }));
    const ready = await request(app.getHttpServer()).get("/health/ready");
    expect(ready.status, ready.text).toBe(503);
    expect(ready.body.status).toBe("unavailable");
    expect(ready.body.checks).toEqual([{ name: "catalog", ok: false }]);
  });
});

function parseLine(line: string): Record<string, unknown> {
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#test/integration.spec.ts";
