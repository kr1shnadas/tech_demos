/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockProvider } from "../src/provider/mock.js";
import { ApprovalError } from "../src/runtime/errors.js";
import { WorkflowOrchestrator, type WorkflowRun } from "../src/runtime/orchestrator.js";
import { notesConfig } from "./support/notes.js";

const intent = "Write the receiving notes for the desk";

function open(profile: string, dir: string): WorkflowOrchestrator {
  return new WorkflowOrchestrator({
    config: notesConfig(dir, { profile }),
    provider: new MockProvider(),
    env: {},
  });
}

async function finish(orchestrator: WorkflowOrchestrator, run: WorkflowRun, actor: string): Promise<WorkflowRun> {
  let current = run;
  while (current.status === "awaiting_approval") {
    current = await orchestrator.approve(current.id, actor);
  }
  return current;
}

describe("approval gates", () => {
  it("stops a startup run only where the workflow asked", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-startup-"));
    const orchestrator = open("startup", dir);
    const started = await orchestrator.start({ workflow: "notes", intent, actor: "ada" });
    expect(started.status).toBe("awaiting_approval");
    expect(started.phases[0]?.phase).toBe("inception");

    const second = await orchestrator.approve(started.id, "ada");
    expect(second.status).toBe("awaiting_approval");
    expect(second.phases[1]?.status).toBe("awaiting_approval");
    expect(second.phases[0]?.status).toBe("completed");

    const done = await orchestrator.approve(second.id, "ada");
    expect(done.status).toBe("completed");
    expect(done.phases.map((phase) => phase.status)).toEqual(["completed", "completed", "completed"]);
    const waiting = orchestrator.audit().filter((entry) => entry.action === "phase.awaiting_approval");
    expect(waiting.map((entry) => entry.phase)).toEqual(["inception", "construction"]);
  });

  it("stops a regulated run after every phase", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-regulated-"));
    const orchestrator = open("regulated", dir);
    let run = await orchestrator.start({ workflow: "notes", intent, actor: "ada", profile: "regulated" });
    const paused: string[] = [];
    while (run.status === "awaiting_approval") {
      paused.push(run.phases[run.phaseIndex]?.phase ?? "");
      run = await orchestrator.approve(run.id, "ada");
    }
    expect(paused).toEqual(["inception", "construction", "operations"]);
    expect(run.status).toBe("completed");
  });

  it("does not continue after a rejection", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-reject-"));
    const orchestrator = open("startup", dir);
    const started = await orchestrator.start({ workflow: "notes", intent, actor: "ada" });
    const rejected = await orchestrator.reject(started.id, "ada", "The units of work are wrong.");
    expect(rejected.status).toBe("rejected");
    expect(rejected.phases[0]?.approvedBy).toBe("ada");
    await expect(orchestrator.approve(started.id, "ada")).rejects.toBeInstanceOf(ApprovalError);
    const decision = orchestrator.audit().find((entry) => entry.action === "phase.rejected");
    expect(decision?.actor).toBe("ada");
    expect(decision?.phase).toBe("inception");
  });

  it("can run without an audit log when the profile says so", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-quiet-"));
    const orchestrator = new WorkflowOrchestrator({
      config: notesConfig(dir, { profile: "quiet", operationsGate: false }),
      provider: new MockProvider(),
      env: {},
    });
    const started = await orchestrator.start({ workflow: "notes", intent, actor: "ada", profile: "quiet" });
    const done = await finish(orchestrator, started, "ada");
    expect(done.status).toBe("completed");
    expect(orchestrator.audit()).toEqual([]);
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/approval.spec.ts";
