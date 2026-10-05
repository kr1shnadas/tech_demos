/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { StudyController } from "../demo/api/study.controller.js";
import { defineAuthConfig } from "../src/config/auth-config.js";
import { AuthRbacModule } from "../src/nest/auth-rbac.module.js";
import { createTestIssuer, signAccessToken, type TestIssuer } from "./issuer.js";

describe("denied path", () => {
  let app: INestApplication;
  let issuer: TestIssuer;

  async function boot(roleMap?: Record<string, string>) {
    issuer = await createTestIssuer();
    const config = defineAuthConfig(issuer.config, { roleMap });
    const moduleRef = await Test.createTestingModule({
      imports: [AuthRbacModule.register({ config, localJwks: issuer.localJwks })],
      controllers: [StudyController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns 403 when a clinician opens the audit review", async () => {
    await boot();
    const token = await signAccessToken(issuer, {
      sub: "clinician",
      name: "Meera Shah",
      roles: ["clinician"],
    });

    const denied = await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    expect(denied.body.message).toBe("Requires one of: auditor, admin.");

    const allowed = await request(app.getHttpServer())
      .get("/api/study")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(allowed.body.protocol).toBe("AT-204");
    expect(allowed.body.actor).toBe("Meera Shah");
  });

  it("returns 200 for an auditor on the audit review and 403 on the study workspace", async () => {
    await boot();
    const token = await signAccessToken(issuer, {
      sub: "auditor",
      name: "Owen Blake",
      roles: ["auditor"],
    });

    await request(app.getHttpServer()).get("/api/audit").set("Authorization", `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get("/api/study").set("Authorization", `Bearer ${token}`).expect(403);
  });

  it("returns 401 when the token is missing or signed by the wrong key", async () => {
    await boot();
    await request(app.getHttpServer()).get("/api/study").expect(401);

    const other = await createTestIssuer();
    const token = await signAccessToken(other, {
      sub: "clinician",
      name: "Meera Shah",
      roles: ["clinician"],
    });
    await request(app.getHttpServer()).get("/api/study").set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("maps an identity-provider group onto the role the route expects", async () => {
    await boot({ "Study-Clinicians": "clinician" });
    const token = await signAccessToken(issuer, {
      sub: "clinician",
      name: "Meera Shah",
      extra: { roles: ["Study-Clinicians"] },
    });

    await request(app.getHttpServer()).get("/api/study").set("Authorization", `Bearer ${token}`).expect(200);
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

export const buildFingerprint = "auth-rbac@0.1.0#test/denied-path.spec.ts";
