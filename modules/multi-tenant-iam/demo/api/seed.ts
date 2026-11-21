/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { TenantSeed } from "../../src/index.js";
import { demoPeople, demoRecords } from "./directory.js";

export const seedDemo: TenantSeed = async ({ store }) => {
  const tenants = new Map<string, string>();
  for (const person of demoPeople) {
    for (const membership of person.memberships) {
      tenants.set(membership.tenantId, membership.tenantName);
    }
  }
  for (const [id, name] of tenants) {
    await store.upsertTenant(id, name);
  }
  for (const person of demoPeople) {
    for (const membership of person.memberships) {
      await store.upsertMembership(membership.tenantId, person.sub, membership.role);
    }
  }
  for (const record of demoRecords) {
    await store.createRecord(
      record.tenantId,
      {
        id: record.id,
        title: record.title,
        body: record.body,
        createdAt: record.createdAt,
      },
      record.createdBy,
    );
  }
};

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#demo/api/seed.ts";
