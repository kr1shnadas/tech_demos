/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../demo/api/app.module.js";
import { createDemoIssuer, type DemoIssuer } from "../demo/api/session.js";
import { defineTenantConfig, type TenantIamConfig, type TenantSource } from "../src/config/tenant-config.js";
import { createDatabase, dropDatabase, startPostgres, type PostgresHandle } from "./support/postgres.js";

const northwindIds = ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111112"];
const harborIds = ["22222222-2222-4222-8222-222222222221", "22222222-2222-4222-8222-222222222222"];

describe("tenant guards", () => {
  let postgres: PostgresHandle;
  let issuer: DemoIssuer;
  let jwtApp: INestApplication;
  let headerApp: INestApplication;
  let hostApp: INestApplication;

  beforeAll(async () => {
    postgres = await startPostgres();
    issuer = await createDemoIssuer();
    await createDatabase(postgres, "iam_http");
    jwtApp = await boot(postgres, issuer, "iam_http", "jwt");
    headerApp = await boot(postgres, issuer, "iam_http", "header");
    hostApp = await boot(postgres, issuer, "iam_http", "subdomain");
  });

  afterAll(async () => {
    await jwtApp?.close();
    await headerApp?.close();
    await hostApp?.close();
    if (!postgres) return;
    await dropDatabase(postgres, "iam_http");
    await postgres.stop();
  });

  it("lists only the tenant on the token", async () => {
    const meeraNorth = await openSession(jwtApp, "meera", "northwind");
    const north = await request(jwtApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${meeraNorth}`)
      .expect(200);
    expect(north.body.records.map((row: { id: string }) => row.id).sort()).toEqual(northwindIds);
    expect(JSON.stringify(north.body)).not.toContain("Temperature excursion");

    const meeraHarbor = await openSession(jwtApp, "meera", "harbor");
    const harbor = await request(jwtApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${meeraHarbor}`)
      .expect(200);
    expect(harbor.body.records.map((row: { id: string }) => row.id).sort()).toEqual(harborIds);
    expect(JSON.stringify(harbor.body)).not.toContain("NW-14");

    const audit = await request(jwtApp.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${meeraNorth}`)
      .expect(200);
    expect(audit.body.events.every((event: { tenantId: string }) => event.tenantId === "northwind")).toBe(true);
    expect(JSON.stringify(audit.body)).not.toContain("Screening log");
  });

  it("keeps a reader from writing and ignores a role claim on the token", async () => {
    const token = await sign(issuer, {
      sub: "meera",
      name: "Meera Shah",
      tenantId: "harbor",
      roles: ["owner"],
    });
    const me = await request(jwtApp.getHttpServer()).get("/api/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.role).toBe("reader");
    expect(me.body.permissions).not.toContain("records.write");

    const denied = await request(jwtApp.getHttpServer())
      .post("/api/records")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Should not land", body: "A reader does not write Harbor notes." })
      .expect(403);
    expect(denied.body.message).toMatch(/records\.write/);

    const records = await request(jwtApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(records.body.records.some((row: { title: string }) => row.title === "Should not land")).toBe(false);
  });

  it("refuses a tenant the person does not belong to", async () => {
    await request(jwtApp.getHttpServer()).post("/api/session").send({ sub: "owen", tenantId: "northwind" }).expect(403);

    const token = await sign(issuer, { sub: "owen", name: "Owen Blake", tenantId: "northwind" });
    await request(jwtApp.getHttpServer()).get("/api/records").set("Authorization", `Bearer ${token}`).expect(403);
    await request(jwtApp.getHttpServer()).get("/api/records").expect(401);
  });

  it("uses the header when that source is configured, not the claim", async () => {
    const token = await sign(issuer, { sub: "meera", name: "Meera Shah", tenantId: "northwind" });
    const harbor = await request(headerApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "harbor")
      .expect(200);
    expect(harbor.body.records.map((row: { id: string }) => row.id).sort()).toEqual(harborIds);

    await request(headerApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "northwind")
      .expect(200)
      .expect((res) => {
        expect(res.body.records.map((row: { id: string }) => row.id).sort()).toEqual(northwindIds);
      });

    const owen = await sign(issuer, { sub: "owen", name: "Owen Blake", tenantId: "harbor" });
    await request(headerApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${owen}`)
      .set("x-tenant-id", "northwind")
      .expect(403);
  });

  it("uses the host label when that source is configured", async () => {
    const token = await sign(issuer, { sub: "krishna", name: "Krishna Das", tenantId: "harbor" });
    const north = await request(hostApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${token}`)
      .set("Host", "northwind.localhost")
      .expect(200);
    expect(north.body.tenantId).toBe("northwind");
    expect(north.body.records.map((row: { id: string }) => row.id).sort()).toEqual(northwindIds);

    await request(hostApp.getHttpServer())
      .get("/api/records")
      .set("Authorization", `Bearer ${token}`)
      .set("Host", "localhost")
      .expect(400);
  });
});

async function boot(
  postgres: PostgresHandle,
  issuer: DemoIssuer,
  database: string,
  source: TenantSource,
): Promise<INestApplication> {
  const config: TenantIamConfig = defineTenantConfig({
    resolution: { source },
    postgres: {
      host: postgres.host,
      port: postgres.port,
      user: postgres.user,
      password: postgres.password,
      database,
      appUser: "iam_app",
      appPassword: "iam_app",
    },
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(issuer, config)],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function openSession(app: INestApplication, sub: string, tenantId: string): Promise<string> {
  const response = await request(app.getHttpServer()).post("/api/session").send({ sub, tenantId }).expect(200);
  return response.body.token as string;
}

async function sign(
  issuer: DemoIssuer,
  input: { sub: string; name: string; tenantId: string; roles?: string[] },
): Promise<string> {
  return new SignJWT({
    name: input.name,
    roles: input.roles ?? ["signed-in"],
    tenant_id: input.tenantId,
  })
    .setProtectedHeader({ alg: "RS256", kid: "demo-1" })
    .setSubject(input.sub)
    .setIssuer(issuer.config.issuer)
    .setAudience(issuer.config.audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(issuer.privateKey);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/access.spec.ts";
