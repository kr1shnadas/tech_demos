/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog, fileAuditSink } from "../src/runtime/audit-log.js";
import { sha256 } from "../src/runtime/hash.js";

describe("audit log", () => {
  it("appends who, what and when, and keeps the hashes", () => {
    let tick = Date.parse("2026-04-02T12:00:00.000Z");
    const log = new AuditLog({
      now: () => {
        const current = new Date(tick);
        tick += 1000;
        return current;
      },
    });
    const input = { intent: "Write the receiving notes" };
    const output = { summary: "Three units of work." };
    const entry = log.append({
      actor: "analyst",
      action: "skill.invoke",
      runId: "run_1",
      workflow: "notes",
      phase: "inception",
      skill: "write-note",
      inputHash: sha256(input),
      outputHash: sha256(output),
    });
    expect(entry.seq).toBe(1);
    expect(entry.at).toBe("2026-04-02T12:00:00.000Z");
    expect(entry.actor).toBe("analyst");
    expect(entry.action).toBe("skill.invoke");
    expect(entry.inputHash).toBe(sha256(input));
    expect(entry.outputHash).toBe(sha256(output));
    expect(entry.inputHash).toMatch(/^[a-f0-9]{64}$/);

    log.append({
      actor: "ada",
      action: "phase.approved",
      runId: "run_1",
      workflow: "notes",
      phase: "inception",
      inputHash: sha256({ phase: "inception" }),
      outputHash: sha256({ decision: "approve" }),
    });

    const listed = log.list();
    expect(listed).toHaveLength(2);
    expect(listed[0]?.seq).toBe(1);
    expect(listed[1]?.at).toBe("2026-04-02T12:00:01.000Z");
    const copy = [...listed];
    copy.pop();
    expect(log.list()).toHaveLength(2);
    expect(Object.isFrozen(listed[0])).toBe(true);
    expect(listed[0]?.actor).toBe("analyst");
  });

  it("only appends lines to the file sink", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-audit-"));
    const file = path.join(dir, "audit.jsonl");
    const log = new AuditLog({ sink: fileAuditSink(file) });
    log.append({
      actor: "ada",
      action: "run.start",
      runId: "run_1",
      workflow: "notes",
      inputHash: sha256("in"),
      outputHash: sha256("out"),
    });
    const first = readFileSync(file, "utf8");
    log.append({
      actor: "ada",
      action: "run.completed",
      runId: "run_1",
      workflow: "notes",
      inputHash: sha256("in-2"),
      outputHash: sha256("out-2"),
    });
    const second = readFileSync(file, "utf8");
    expect(second.startsWith(first)).toBe(true);
    expect(second.split("\n").filter(Boolean)).toHaveLength(2);
    expect(first).toContain("run.start");
    expect(first).not.toContain("run.completed");
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/audit.spec.ts";
