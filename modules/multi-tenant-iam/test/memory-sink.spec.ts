/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { MemoryAuditSink } from "../src/audit/memory-sink.js";

describe("memory audit sink", () => {
  it("keeps each tenant's events apart", async () => {
    const sink = new MemoryAuditSink();
    const client = null as unknown as PoolClient;
    await sink.append(client, {
      tenantId: "alpha",
      actorSub: "ada",
      action: "record.create",
      resource: "1",
      detail: { title: "Alpha" },
    });
    await sink.append(client, {
      tenantId: "bravo",
      actorSub: "ben",
      action: "record.create",
      resource: "2",
      detail: { title: "Bravo" },
    });
    const alpha = await sink.list(client, "alpha", 20);
    expect(alpha).toHaveLength(1);
    expect(alpha[0]?.detail.title).toBe("Alpha");
    expect(alpha.some((event) => event.tenantId === "bravo")).toBe(false);
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/memory-sink.spec.ts";
