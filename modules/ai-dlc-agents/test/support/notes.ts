/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { defineKitConfig, type KitConfig } from "../../src/config/kit-config.js";

export function notesConfig(
  outputRoot: string,
  options: { maxSteps?: number; maxTokens?: number; operationsGate?: boolean; profile?: string } = {},
): KitConfig {
  return defineKitConfig({
    profile: options.profile ?? "startup",
    outputRoot,
    profiles:
      options.profile === "quiet"
        ? {
            quiet: {
              description: "Skip the audit log and use the workflow gates.",
              auditLogging: false,
              approval: "as-configured",
            },
          }
        : undefined,
    skills: [
      {
        name: "write-note",
        description: "Write a short note into the sandbox.",
        whenToUse: "When the run needs a note on disk.",
        inputSchema: {
          type: "object",
          required: ["intent", "prior"],
          properties: {
            intent: { type: "string" },
            prior: { type: "object" },
          },
        },
        outputSchema: {
          type: "object",
          required: ["skill", "intent"],
          properties: {
            skill: { type: "string" },
            intent: { type: "string" },
          },
        },
        promptTemplate: "Write a note for {{intent}}",
        allowedTools: ["write_file", "read_file", "list_files"],
      },
    ],
    agents: [
      {
        name: "scribe",
        role: "Scribe",
        provider: "mock",
        modelId: "mock-deterministic",
        systemPrompt: "You write notes inside the sandbox.",
        skills: ["write-note"],
        guardrails: {
          allowedPaths: ["docs"],
          maxTokens: options.maxTokens ?? 2000,
          maxSteps: options.maxSteps ?? 8,
        },
      },
    ],
    workflows: [
      {
        name: "notes",
        description: "Three phases that record a note.",
        outputDir: "notes",
        phases: [
          { phase: "inception", agent: "scribe", skills: ["write-note"], approvalGate: true },
          { phase: "construction", agent: "scribe", skills: ["write-note"], approvalGate: true },
          {
            phase: "operations",
            agent: "scribe",
            skills: ["write-note"],
            approvalGate: options.operationsGate ?? false,
          },
        ],
      },
    ],
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/support/notes.ts";
