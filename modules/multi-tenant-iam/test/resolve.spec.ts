/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defineTenantConfig } from "../src/config/tenant-config.js";
import { resolveTenantId, tenantFromHost } from "../src/tenant/resolve.js";

describe("tenant resolution", () => {
  it("reads the tenant claim and ignores the header", () => {
    const config = defineTenantConfig();
    const token = fakeJwt({ tenant_id: "northwind" });
    expect(resolveTenantId(config, { token, header: "harbor" })).toBe("northwind");
  });

  it("reads a nested claim", () => {
    const config = defineTenantConfig({ resolution: { jwtClaim: "org.id" } });
    const token = fakeJwt({ org: { id: "harbor" } });
    expect(resolveTenantId(config, { token })).toBe("harbor");
  });

  it("reads the header when that is the source", () => {
    const config = defineTenantConfig({ resolution: { source: "header" } });
    const token = fakeJwt({ tenant_id: "northwind" });
    expect(resolveTenantId(config, { token, header: "harbor" })).toBe("harbor");
  });

  it("reads the host label before the base domain", () => {
    expect(tenantFromHost("northwind.localhost:3000", "localhost")).toBe("northwind");
    expect(tenantFromHost("localhost:3000", "localhost")).toBeUndefined();
    expect(tenantFromHost("a.b.localhost", "localhost")).toBeUndefined();
    const config = defineTenantConfig({ resolution: { source: "subdomain" } });
    expect(resolveTenantId(config, { host: "harbor.localhost" })).toBe("harbor");
  });

  it("rejects a missing claim", () => {
    const config = defineTenantConfig();
    expect(() => resolveTenantId(config, { token: fakeJwt({ name: "Meera" }) })).toThrow(/claim/);
  });
});

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/resolve.spec.ts";
