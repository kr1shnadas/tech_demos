/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { evaluatePermissions, permissionsFor } from "../src/access/permissions.js";
import { defineTenantConfig } from "../src/config/tenant-config.js";

describe("tenant permissions", () => {
  const config = defineTenantConfig({
    roleOverrides: {
      harbor: [
        { name: "member", permissions: ["records.read"] },
        { name: "reader", permissions: ["records.read", "audit.read"] },
      ],
    },
  });

  it("uses the catalog when the tenant has no override", () => {
    expect(permissionsFor(config, "northwind", "owner")).toContain("records.write");
    expect(permissionsFor(config, "northwind", "reader")).not.toContain("records.write");
  });

  it("uses the tenant override instead of the catalog", () => {
    expect(permissionsFor(config, "harbor", "member")).toEqual(["records.read"]);
    expect(permissionsFor(config, "harbor", "owner")).toEqual([]);
  });

  it("requires every listed permission", () => {
    const held = ["records.read", "audit.read"];
    expect(evaluatePermissions(held, ["records.read"]).allowed).toBe(true);
    expect(evaluatePermissions(held, ["records.write"]).allowed).toBe(false);
    expect(evaluatePermissions(held, []).reason).toMatch(/Membership/);
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/permissions.spec.ts";
