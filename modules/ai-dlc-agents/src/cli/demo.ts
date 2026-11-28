/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import path from "node:path";
import { parseArgs } from "node:util";
import { loadKitConfig } from "../config/load-config.js";
import { MockProvider } from "../provider/mock.js";
import { fileAuditSink } from "../runtime/audit-log.js";
import { WorkflowOrchestrator, type WorkflowRun } from "../runtime/orchestrator.js";

const { values } = parseArgs({
  options: {
    intent: { type: "string", default: "Build a NestJS CRUD service for library books" },
    profile: { type: "string" },
    actor: { type: "string", default: "demo" },
    workflow: { type: "string", default: "nestjs-crud" },
    config: { type: "string", default: "examples/nestjs-crud.yaml" },
    hold: { type: "boolean", default: false },
  },
});

const config = loadKitConfig({ path: values.config });
const outputRoot = path.resolve(config.outputRoot);
const orchestrator = new WorkflowOrchestrator({
  config: { ...config, outputRoot },
  provider: new MockProvider(),
  env: process.env,
  auditSink: fileAuditSink(path.join(outputRoot, "audit.jsonl")),
});

const actor = values.actor ?? "demo";
let run = await orchestrator.start({
  workflow: values.workflow ?? "nestjs-crud",
  intent: values.intent ?? "Build a NestJS CRUD service for library books",
  actor,
  ...(values.profile ? { profile: values.profile } : {}),
});
printRun(run);

if (!values.hold) {
  while (run.status === "awaiting_approval") {
    const phase = run.phases[run.phaseIndex]?.phase ?? "phase";
    console.log(`approval gate open for ${phase}; recording approval from ${actor}`);
    run = await orchestrator.approve(run.id, actor);
    printRun(run);
  }
}

console.log("");
console.log("audit");
for (const entry of orchestrator.audit().filter((entry) => entry.runId === run.id)) {
  const where = [entry.phase, entry.skill].filter(Boolean).join(" ");
  console.log(`${String(entry.seq).padStart(2, " ")}  ${entry.action}  ${entry.actor}${where ? `  ${where}` : ""}`);
}
console.log("");
console.log(`output: ${run.outputDir}`);
console.log("Krishna Das — Apache-2.0");

if (run.status === "failed") {
  console.error(run.error ?? "the run failed.");
  process.exitCode = 1;
}

function printRun(current: WorkflowRun): void {
  const phase = current.phases[current.phaseIndex]?.phase ?? "done";
  console.log(`${current.id}  ${current.status}  ${current.status === "completed" ? "done" : phase}`);
  const latest = current.phases.flatMap((item) => item.steps).at(-1);
  if (latest) console.log(`  ${latest.skill}: ${latest.summary}`);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/cli/demo.ts";
