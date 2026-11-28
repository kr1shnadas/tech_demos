/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { DeskController } from "../demo/api/desk.controller.js";
import { defineKitConfig } from "../src/config/kit-config.js";
import { loadKitConfig } from "../src/config/load-config.js";
import { LifecycleModule } from "../src/nest/lifecycle.module.js";
import { MockProvider } from "../src/provider/mock.js";
import type { WorkflowRun } from "../src/runtime/orchestrator.js";

const example = path.resolve(import.meta.dirname, "../examples/nestjs-crud.yaml");
const intent = "Build a NestJS CRUD service for library books";

describe("http surface", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
  });

  it("starts a run, takes approvals and shows the audit log", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-api-"));
    const loaded = loadKitConfig({ path: example, env: {} });
    const config = defineKitConfig({ ...loaded, outputRoot: dir });
    const moduleRef = await Test.createTestingModule({
      imports: [LifecycleModule.register({ config, env: {}, provider: new MockProvider() })],
      controllers: [DeskController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const live = await request(app.getHttpServer()).get("/health/live").expect(200);
    expect(live.body).toEqual({ status: "ok" });
    const ready = await request(app.getHttpServer()).get("/health/ready").expect(200);
    expect(ready.body).toEqual({ status: "ok" });

    const page = await request(app.getHttpServer()).get("/").expect(200);
    expect(page.text).toContain("Krishna Das");
    expect(page.text).toContain("nestjs-crud");

    const started = await request(app.getHttpServer())
      .post("/api/runs")
      .send({ workflow: "nestjs-crud", intent, actor: "ada", profile: "startup" })
      .expect(201);
    let body = started.body as WorkflowRun;
    expect(body.status).toBe("awaiting_approval");

    while (body.status === "awaiting_approval") {
      const decision = await request(app.getHttpServer())
        .post(`/api/runs/${body.id}/approvals`)
        .send({ actor: "ada", decision: "approve" })
        .expect(200);
      body = decision.body as WorkflowRun;
    }
    expect(body.status).toBe("completed");
    expect(body.phases.flatMap((phase) => phase.steps).map((step) => step.skill)).toEqual([
      "requirements-to-stories",
      "domain-model",
      "generate-nest-module",
      "generate-tests",
      "review-diff",
    ]);

    const listed = await request(app.getHttpServer()).get("/api/runs").expect(200);
    expect(listed.body).toHaveLength(1);

    const audit = await request(app.getHttpServer()).get("/api/audit").expect(200);
    expect(audit.body.some((entry: { action: string }) => entry.action === "file.write")).toBe(true);
    expect(audit.body.some((entry: { action: string; actor: string }) => entry.action === "phase.approved" && entry.actor === "ada")).toBe(true);

    await request(app.getHttpServer()).get("/api/runs/missing").expect(404);
    await request(app.getHttpServer())
      .post(`/api/runs/${body.id}/approvals`)
      .send({ actor: "ada", decision: "approve" })
      .expect(409);
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/api.spec.ts";
