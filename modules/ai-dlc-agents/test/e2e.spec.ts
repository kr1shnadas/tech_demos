/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineKitConfig } from "../src/config/kit-config.js";
import { loadKitConfig } from "../src/config/load-config.js";
import { MockProvider } from "../src/provider/mock.js";
import { sha256 } from "../src/runtime/hash.js";
import { WorkflowOrchestrator, type WorkflowRun } from "../src/runtime/orchestrator.js";

const example = path.resolve(import.meta.dirname, "../examples/nestjs-crud.yaml");
const intent = "Build a NestJS CRUD service for library books";

function orchestrator(dir: string, profile = "startup"): WorkflowOrchestrator {
  const loaded = loadKitConfig({ path: example, env: {} });
  const config = defineKitConfig({ ...loaded, outputRoot: dir, profile });
  return new WorkflowOrchestrator({ config, provider: new MockProvider(), env: {} });
}

async function runToDone(profile: string, dir: string): Promise<{ orchestrator: WorkflowOrchestrator; run: WorkflowRun }> {
  const runtime = orchestrator(dir, profile);
  let run = await runtime.start({ workflow: "nestjs-crud", intent, actor: "ada", profile });
  while (run.status === "awaiting_approval") {
    run = await runtime.approve(run.id, "ada");
  }
  return { orchestrator: runtime, run };
}

describe("nestjs crud run", () => {
  it("writes the module, records the gates and hashes the files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-e2e-"));
    const first = await runToDone("startup", dir);
    const secondDir = mkdtempSync(path.join(tmpdir(), "kit-e2e-"));
    const second = await runToDone("startup", secondDir);

    expect(first.run.status).toBe("completed");
    const servicePath = path.join(first.run.outputDir, "src/books/books.service.ts");
    const controllerPath = path.join(first.run.outputDir, "src/books/books.controller.ts");
    const testPath = path.join(first.run.outputDir, "test/books.service.spec.ts");
    const reviewPath = path.join(first.run.outputDir, "docs/review.md");
    expect(readFileSync(servicePath, "utf8")).toContain("class BooksService");
    expect(readFileSync(controllerPath, "utf8")).toContain('@Controller("books")');
    expect(readFileSync(testPath, "utf8")).toContain("BooksService");
    expect(readFileSync(reviewPath, "utf8")).toContain("Verdict: accept");
    expect(existsSync(path.join(dir, "outside.txt"))).toBe(false);

    const audit = first.orchestrator.audit();
    expect(audit[0]).toMatchObject({ actor: "ada", action: "run.start" });
    expect(audit.every((entry) => entry.at.startsWith("20") && entry.inputHash.length === 64)).toBe(true);
    const writes = audit.filter((entry) => entry.action === "file.write");
    const serviceWrite = writes.find((entry) => entry.inputHash === sha256("src/books/books.service.ts"));
    expect(serviceWrite?.actor).toBe("builder");
    expect(serviceWrite?.outputHash).toBe(sha256(readFileSync(servicePath, "utf8")));
    expect(audit.filter((entry) => entry.action === "phase.awaiting_approval").map((entry) => entry.phase)).toEqual([
      "inception",
      "construction",
    ]);
    expect(audit.some((entry) => entry.action === "phase.approved" && entry.actor === "ada")).toBe(true);
    expect(audit.some((entry) => entry.action === "tool.list_files" && entry.actor === "reviewer")).toBe(true);

    const skillHash = (runtime: WorkflowOrchestrator, runId: string) =>
      runtime
        .audit()
        .find((entry) => entry.runId === runId && entry.skill === "requirements-to-stories")?.inputHash;
    expect(skillHash(first.orchestrator, first.run.id)).toBe(skillHash(second.orchestrator, second.run.id));
  });

  it("pauses a regulated run on the operations phase too", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-e2e-reg-"));
    const runtime = orchestrator(dir, "regulated");
    let run = await runtime.start({ workflow: "nestjs-crud", intent, actor: "ada", profile: "regulated" });
    let pauses = 0;
    while (run.status === "awaiting_approval") {
      pauses += 1;
      run = await runtime.approve(run.id, "ada");
    }
    expect(pauses).toBe(3);
    expect(run.status).toBe("completed");
    expect(runtime.audit().filter((entry) => entry.action === "phase.awaiting_approval")).toHaveLength(3);
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/e2e.spec.ts";
