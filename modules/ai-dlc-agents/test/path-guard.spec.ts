/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ModelProvider } from "../src/provider/types.js";
import { WorkflowOrchestrator } from "../src/runtime/orchestrator.js";
import { resolveSandboxed, writeSandboxed } from "../src/runtime/path-guard.js";
import { notesConfig } from "./support/notes.js";

describe("path guard", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kit-paths-"));

  it("writes under an allowed prefix and refuses escapes", () => {
    const full = writeSandboxed(root, "src/books/books.service.ts", ["src"], "export {}\n");
    expect(full.startsWith(path.resolve(root))).toBe(true);
    expect(existsSync(full)).toBe(true);
    expect(() => resolveSandboxed(root, "../outside.txt", ["src"])).toThrow(/output directory/);
    expect(() => resolveSandboxed(root, "src/../../outside.txt", ["src"])).toThrow(/output directory/);
    expect(() => resolveSandboxed(root, "/etc/passwd", ["src"])).toThrow(/output directory/);
    expect(() => resolveSandboxed(root, "test/books.spec.ts", ["src"])).toThrow(/outside the allowed paths/);
    expect(existsSync(path.resolve(root, "../outside.txt"))).toBe(false);
  });

  it("fails the run when a skill tries to write outside the sandbox", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-escape-"));
    const outside = path.join(dir, "outside.txt");
    const provider: ModelProvider = {
      kind: "mock",
      async complete() {
        return {
          text: JSON.stringify({
            summary: "Tried to leave the sandbox.",
            artifact: { skill: "write-note", intent: "leave the sandbox now" },
            files: [{ path: "../outside.txt", contents: "nope" }],
          }),
          tokensUsed: 20,
          truncated: false,
        };
      },
    };
    const orchestrator = new WorkflowOrchestrator({
      config: notesConfig(dir),
      provider,
      env: {},
    });
    const run = await orchestrator.start({
      workflow: "notes",
      intent: "Leave the sandbox now",
      actor: "ada",
    });
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/output directory/);
    expect(existsSync(outside)).toBe(false);
    expect(orchestrator.audit().some((entry) => entry.action === "run.failed")).toBe(true);
    expect(orchestrator.audit().some((entry) => entry.action === "file.write")).toBe(false);
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/path-guard.spec.ts";
