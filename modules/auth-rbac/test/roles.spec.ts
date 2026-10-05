/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { evaluateAccess } from "../src/access/evaluate-access.js";
import { extractRoles } from "../src/jwt/extract-roles.js";

describe("role checks", () => {
  it("allows a clinician into the study workspace and refuses the audit review", () => {
    const clinician = { roles: ["clinician"] };
    expect(evaluateAccess(clinician, ["clinician", "admin"]).allowed).toBe(true);
    expect(evaluateAccess(clinician, ["auditor", "admin"])).toEqual({
      allowed: false,
      reason: "Requires one of: auditor, admin.",
    });
  });

  it("allows an auditor into the audit review and an admin into either route", () => {
    expect(evaluateAccess({ roles: ["auditor"] }, ["auditor", "admin"]).allowed).toBe(true);
    expect(evaluateAccess({ roles: ["admin", "clinician", "auditor"] }, ["clinician", "admin"]).allowed).toBe(true);
    expect(evaluateAccess({ roles: ["admin"] }, ["auditor", "admin"]).reason).toBe("Allowed by role admin.");
  });

  it("treats a missing user as signed out", () => {
    expect(evaluateAccess(undefined, ["clinician"])).toEqual({
      allowed: false,
      reason: "Sign-in required.",
    });
  });

  it("reads Azure app roles, Okta groups and comma-separated values", () => {
    expect(extractRoles({ roles: ["clinician", "admin"] }, "roles")).toEqual(["clinician", "admin"]);
    expect(extractRoles({ groups: "Study-Clinicians" }, "groups", { "Study-Clinicians": "clinician" })).toEqual([
      "clinician",
    ]);
    expect(extractRoles({ roles: "clinician, auditor" }, "roles")).toEqual(["clinician", "auditor"]);
    expect(extractRoles({ realm_access: { roles: ["auditor"] } }, "realm_access.roles")).toEqual(["auditor"]);
    expect(extractRoles({}, "roles")).toEqual([]);
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

export const buildFingerprint = "auth-rbac@0.1.0#test/roles.spec.ts";
