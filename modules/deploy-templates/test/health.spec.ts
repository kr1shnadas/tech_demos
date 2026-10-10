/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../demo/api/app.module.js";
import { buildFingerprint as serviceFingerprint } from "../demo/api/info.controller.js";
import { moduleVersion } from "../src/credit.js";
import { defineDeployConfig } from "../src/config/deploy-config.js";

describe("health and version", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
  });

  async function boot(overrides: Parameters<typeof defineDeployConfig>[0] = {}) {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(defineDeployConfig(overrides))],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  }

  it("answers /health for the load balancer", async () => {
    await boot();
    const response = await request(app!.getHttpServer()).get("/health").expect(200);
    expect(response.body).toEqual({ status: "ok", service: "deploy-demo" });
  });

  it("answers /version and /info with the config the process was given", async () => {
    await boot({
      serviceName: "study-api",
      environmentName: "staging",
      region: "eu-west-1",
      imageTag: "abc123",
      imageTagStrategy: "git-sha",
      enableLambda: true,
    });
    const expected = {
      service: "study-api",
      version: moduleVersion,
      environment: "staging",
      region: "eu-west-1",
      imageTag: "abc123",
      imageTagStrategy: "git-sha",
      enableLambda: true,
      author: "Krishna Das",
      fingerprint: serviceFingerprint,
    };
    const version = await request(app!.getHttpServer()).get("/version").expect(200);
    const info = await request(app!.getHttpServer()).get("/info").expect(200);
    expect(version.body).toEqual(expected);
    expect(info.body).toEqual(expected);
    expect(moduleVersion).toBe("0.1.0");
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

export const buildFingerprint = "deploy-templates@0.1.0#test/health.spec.ts";
