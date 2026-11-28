/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { AgentSpec, KitConfig, PhaseSpec, ProfileSpec, ProviderKind, WorkflowSpec } from "../config/kit-config.js";
import { assertMatchesSchema } from "../config/match-schema.js";
import { createProvider } from "../provider/create.js";
import type { ModelProvider, SkillInput } from "../provider/types.js";
import { AuditLog, type AuditDraft, type AuditEntry } from "./audit-log.js";
import { ApprovalError, GuardrailError, RequestError, RunNotFoundError } from "./errors.js";
import { sha256 } from "./hash.js";
import { listSandboxed, readSandboxed, writeSandboxed } from "./path-guard.js";

const actorName = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;

const envelopeSchema = z
  .object({
    summary: z.string().min(1),
    artifact: z.record(z.string(), z.unknown()),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1),
            contents: z.string(),
          })
          .strict(),
      )
      .optional(),
    toolCalls: z
      .array(
        z
          .object({
            tool: z.enum(["write_file", "read_file", "list_files"]),
            path: z.string().min(1).optional(),
            contents: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

type Envelope = z.infer<typeof envelopeSchema>;

export interface StepRecord {
  skill: string;
  summary: string;
  inputHash: string;
  outputHash: string;
  files: string[];
}

export type PhaseStatus = "pending" | "running" | "awaiting_approval" | "approved" | "completed" | "failed" | "rejected";

export interface PhaseState {
  phase: PhaseSpec["phase"];
  agent: string;
  status: PhaseStatus;
  steps: StepRecord[];
  approvedBy?: string;
}

export type RunStatus = "running" | "awaiting_approval" | "completed" | "rejected" | "failed";

export interface WorkflowRun {
  id: string;
  workflow: string;
  profile: string;
  intent: string;
  startedBy: string;
  status: RunStatus;
  phaseIndex: number;
  phases: PhaseState[];
  outputDir: string;
  artifacts: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartRequest {
  workflow: string;
  intent: string;
  actor: string;
  profile?: string;
}

export interface OrchestratorOptions {
  config: KitConfig;
  /** When set, every role uses this provider. Tests pass the mock here. */
  provider?: ModelProvider;
  /** `DLC_PROVIDER` forces every role onto one kind. Unset means each role uses its own. */
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  ids?: () => string;
  auditSink?: (entry: AuditEntry) => void;
  audit?: AuditLog;
}

interface RunBody extends WorkflowRun {
  artifacts: Record<string, unknown>;
}

/**
 * Runs a workflow one phase at a time. A gate stops the run until `approve` or `reject`.
 * The next phase does not start on its own.
 */
export class WorkflowOrchestrator {
  private readonly runs = new Map<string, RunBody>();
  private readonly providers = new Map<ProviderKind, ModelProvider>();
  private readonly auditLog: AuditLog;
  private readonly now: () => Date;
  private readonly ids: () => string;
  private readonly env: NodeJS.ProcessEnv;

  constructor(private readonly options: OrchestratorOptions) {
    this.now = options.now ?? (() => new Date());
    this.ids = options.ids ?? (() => `run_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
    this.env = options.env ?? {};
    this.auditLog = options.audit ?? new AuditLog({ now: this.now, sink: options.auditSink });
  }

  async start(request: StartRequest): Promise<WorkflowRun> {
    const workflow = this.options.config.workflows.find((item) => item.name === request.workflow);
    if (!workflow) throw new RequestError(`workflow ${request.workflow} is not defined.`);
    const profileName = request.profile ?? this.options.config.profile;
    const profile = this.options.config.profiles[profileName];
    if (!profile) throw new RequestError(`profile ${profileName} is not defined.`);
    assertActor(request.actor);
    assertIntent(request.intent);
    const id = this.ids();
    const createdAt = this.stamp();
    const run: RunBody = {
      id,
      workflow: workflow.name,
      profile: profileName,
      intent: request.intent.trim(),
      startedBy: request.actor,
      status: "running",
      phaseIndex: 0,
      phases: workflow.phases.map((phase) => ({
        phase: phase.phase,
        agent: phase.agent,
        status: "pending",
        steps: [],
      })),
      outputDir: outputDirFor(this.options.config, workflow, id),
      artifacts: {},
      createdAt,
      updatedAt: createdAt,
    };
    this.runs.set(run.id, run);
    this.record(profile, {
      actor: request.actor,
      action: "run.start",
      runId: run.id,
      workflow: run.workflow,
      inputHash: sha256({ intent: run.intent, profile: profileName, workflow: workflow.name }),
      outputHash: sha256({ id: run.id, status: "running" }),
    });
    return this.advance(run);
  }

  async approve(runId: string, actor: string, comment?: string): Promise<WorkflowRun> {
    return this.decide(runId, actor, "approve", comment);
  }

  async reject(runId: string, actor: string, comment?: string): Promise<WorkflowRun> {
    return this.decide(runId, actor, "reject", comment);
  }

  get(runId: string): WorkflowRun {
    return this.view(this.must(runId));
  }

  list(): WorkflowRun[] {
    return [...this.runs.values()].reverse().map((run) => this.view(run));
  }

  audit(): readonly AuditEntry[] {
    return this.auditLog.list();
  }

  private async decide(
    runId: string,
    actor: string,
    decision: "approve" | "reject",
    comment?: string,
  ): Promise<WorkflowRun> {
    assertActor(actor);
    const run = this.must(runId);
    if (run.status !== "awaiting_approval") throw new ApprovalError("run is not waiting for approval.");
    const phaseState = run.phases[run.phaseIndex];
    const phase = this.workflow(run.workflow).phases[run.phaseIndex];
    if (!phaseState || !phase || phaseState.status !== "awaiting_approval") {
      throw new ApprovalError("run is not waiting for approval.");
    }
    const profile = this.profile(run.profile);
    const note = comment?.trim() ?? "";
    if (note.length > 500) throw new RequestError("comment must be at most 500 characters.");
    if (decision === "reject") {
      phaseState.status = "rejected";
      phaseState.approvedBy = actor;
      run.status = "rejected";
      run.updatedAt = this.stamp();
      this.record(profile, {
        actor,
        action: "phase.rejected",
        runId: run.id,
        workflow: run.workflow,
        phase: phase.phase,
        inputHash: sha256({ phase: phase.phase, comment: note }),
        outputHash: sha256({ decision: "reject", actor }),
      });
      return this.view(run);
    }
    phaseState.status = "approved";
    phaseState.approvedBy = actor;
    this.record(profile, {
      actor,
      action: "phase.approved",
      runId: run.id,
      workflow: run.workflow,
      phase: phase.phase,
      inputHash: sha256({ phase: phase.phase, comment: note }),
      outputHash: sha256({ decision: "approve", actor }),
    });
    return this.advance(run);
  }

  private async advance(run: RunBody): Promise<WorkflowRun> {
    const profile = this.profile(run.profile);
    const workflow = this.workflow(run.workflow);
    try {
      while (run.phaseIndex < workflow.phases.length) {
        const phase = workflow.phases[run.phaseIndex];
        const state = run.phases[run.phaseIndex];
        if (!phase || !state) break;
        if (state.status === "approved") {
          state.status = "completed";
          run.phaseIndex += 1;
          run.status = "running";
          run.updatedAt = this.stamp();
          continue;
        }
        if (state.status !== "pending") break;
        state.status = "running";
        run.updatedAt = this.stamp();
        this.record(profile, {
          actor: phase.agent,
          action: "phase.start",
          runId: run.id,
          workflow: run.workflow,
          phase: phase.phase,
          inputHash: sha256({ phase: phase.phase, agent: phase.agent }),
          outputHash: sha256({ status: "running" }),
        });
        await this.executePhase(run, phase, state, profile);
        if (needsApproval(profile, phase)) {
          state.status = "awaiting_approval";
          run.status = "awaiting_approval";
          run.updatedAt = this.stamp();
          this.record(profile, {
            actor: "gate",
            action: "phase.awaiting_approval",
            runId: run.id,
            workflow: run.workflow,
            phase: phase.phase,
            inputHash: sha256({ phase: phase.phase }),
            outputHash: sha256({ steps: state.steps.length }),
          });
          return this.view(run);
        }
        state.status = "completed";
        this.record(profile, {
          actor: phase.agent,
          action: "phase.completed",
          runId: run.id,
          workflow: run.workflow,
          phase: phase.phase,
          inputHash: sha256({ phase: phase.phase }),
          outputHash: sha256({ steps: state.steps.length }),
        });
        run.phaseIndex += 1;
        run.updatedAt = this.stamp();
      }
      run.status = "completed";
      run.updatedAt = this.stamp();
      this.record(profile, {
        actor: run.startedBy,
        action: "run.completed",
        runId: run.id,
        workflow: run.workflow,
        inputHash: sha256({ id: run.id }),
        outputHash: sha256({ status: "completed", outputDir: run.outputDir }),
      });
      return this.view(run);
    } catch (error) {
      return this.fail(run, profile, error);
    }
  }

  private async executePhase(
    run: RunBody,
    phase: PhaseSpec,
    state: PhaseState,
    profile: ProfileSpec,
  ): Promise<void> {
    const agent = this.agent(phase.agent);
    let steps = 0;
    const consume = () => {
      steps += 1;
      if (steps > agent.guardrails.maxSteps) {
        throw new GuardrailError(`${agent.name} exceeded max steps (${agent.guardrails.maxSteps}).`);
      }
    };
    for (const skillName of phase.skills) {
      const skill = this.skill(skillName);
      const input: SkillInput = { intent: run.intent, prior: run.artifacts };
      assertMatchesSchema(input, skill.inputSchema, `${skill.name} input`);
      const prompt = renderTemplate(skill.promptTemplate, input);
      consume();
      const modelId = this.modelId(agent);
      const response = await this.providerFor(agent).complete({
        modelId,
        systemPrompt: agent.systemPrompt,
        prompt,
        maxTokens: agent.guardrails.maxTokens,
        skill: skill.name,
        input,
      });
      if (response.truncated || response.tokensUsed > agent.guardrails.maxTokens) {
        throw new GuardrailError(`${agent.name} exceeded max tokens (${agent.guardrails.maxTokens}).`);
      }
      const envelope = parseEnvelope(response.text, skill.name);
      assertMatchesSchema(envelope.artifact, skill.outputSchema, `${skill.name} output`);
      const inputHash = sha256({ skill: skill.name, modelId, prompt, input });
      const outputHash = sha256(envelope);
      this.record(profile, {
        actor: agent.name,
        action: "skill.invoke",
        runId: run.id,
        workflow: run.workflow,
        phase: phase.phase,
        skill: skill.name,
        inputHash,
        outputHash,
      });
      for (const call of envelope.toolCalls ?? []) {
        if (!skill.allowedTools.includes(call.tool)) {
          throw new GuardrailError(`${skill.name} cannot use ${call.tool}.`);
        }
        if (call.tool === "write_file") {
          throw new GuardrailError(`${skill.name} writes through the files list.`);
        }
        consume();
        if (call.tool === "list_files") {
          const listing = listSandboxed(run.outputDir);
          this.record(profile, {
            actor: agent.name,
            action: "tool.list_files",
            runId: run.id,
            workflow: run.workflow,
            phase: phase.phase,
            skill: skill.name,
            inputHash: sha256({ tool: "list_files" }),
            outputHash: sha256(listing),
          });
          continue;
        }
        if (!call.path) throw new GuardrailError(`${skill.name} read_file requires a path.`);
        const text = readSandboxed(run.outputDir, call.path, agent.guardrails.allowedPaths);
        this.record(profile, {
          actor: agent.name,
          action: "tool.read_file",
          runId: run.id,
          workflow: run.workflow,
          phase: phase.phase,
          skill: skill.name,
          inputHash: sha256(call.path),
          outputHash: sha256(text),
        });
      }
      const written: string[] = [];
      for (const file of envelope.files ?? []) {
        if (!skill.allowedTools.includes("write_file")) {
          throw new GuardrailError(`${skill.name} cannot write files.`);
        }
        consume();
        writeSandboxed(run.outputDir, file.path, agent.guardrails.allowedPaths, file.contents);
        written.push(file.path);
        this.record(profile, {
          actor: agent.name,
          action: "file.write",
          runId: run.id,
          workflow: run.workflow,
          phase: phase.phase,
          skill: skill.name,
          inputHash: sha256(file.path),
          outputHash: sha256(file.contents),
        });
      }
      run.artifacts[skill.name] = envelope.artifact;
      state.steps.push({
        skill: skill.name,
        summary: envelope.summary,
        inputHash,
        outputHash,
        files: written,
      });
    }
  }

  private fail(run: RunBody, profile: ProfileSpec, error: unknown): WorkflowRun {
    const message = error instanceof Error ? error.message : "the phase failed.";
    run.status = "failed";
    run.error = message;
    run.updatedAt = this.stamp();
    const phase = run.phases[run.phaseIndex];
    if (phase && (phase.status === "running" || phase.status === "pending")) phase.status = "failed";
    this.record(profile, {
      actor: run.startedBy,
      action: "run.failed",
      runId: run.id,
      workflow: run.workflow,
      phase: phase?.phase,
      inputHash: sha256({ phase: phase?.phase ?? "" }),
      outputHash: sha256(message),
    });
    return this.view(run);
  }

  private providerFor(agent: AgentSpec): ModelProvider {
    if (this.options.provider) return this.options.provider;
    const forced = readForcedKind(this.env.DLC_PROVIDER);
    const kind = forced ?? agent.provider;
    const existing = this.providers.get(kind);
    if (existing) return existing;
    const created = createProvider(kind, this.options.config, this.env);
    this.providers.set(kind, created);
    return created;
  }

  private modelId(agent: AgentSpec): string {
    const override = this.env.DLC_PROVIDER_MODEL;
    if (override && override.trim()) return override.trim();
    return agent.modelId;
  }

  private record(profile: ProfileSpec, draft: AuditDraft): void {
    if (!profile.auditLogging) return;
    this.auditLog.append(draft);
  }

  private must(runId: string): RunBody {
    const run = this.runs.get(runId);
    if (!run) throw new RunNotFoundError(`run ${runId} was not found.`);
    return run;
  }

  private workflow(name: string): WorkflowSpec {
    const workflow = this.options.config.workflows.find((item) => item.name === name);
    if (!workflow) throw new RequestError(`workflow ${name} is not defined.`);
    return workflow;
  }

  private profile(name: string): ProfileSpec {
    const profile = this.options.config.profiles[name];
    if (!profile) throw new RequestError(`profile ${name} is not defined.`);
    return profile;
  }

  private agent(name: string): AgentSpec {
    const agent = this.options.config.agents.find((item) => item.name === name);
    if (!agent) throw new RequestError(`agent ${name} is not defined.`);
    return agent;
  }

  private skill(name: string) {
    const skill = this.options.config.skills.find((item) => item.name === name);
    if (!skill) throw new RequestError(`skill ${name} is not defined.`);
    return skill;
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  private view(run: RunBody): WorkflowRun {
    return structuredClone(run);
  }
}

export function renderTemplate(template: string, input: SkillInput): string {
  return template.replaceAll("{{intent}}", input.intent).replaceAll("{{prior}}", JSON.stringify(input.prior));
}

function needsApproval(profile: ProfileSpec, phase: PhaseSpec): boolean {
  if (profile.approval === "every-phase") return true;
  return phase.approvalGate;
}

function outputDirFor(config: KitConfig, workflow: WorkflowSpec, id: string): string {
  return path.join(config.outputRoot, workflow.outputDir, id);
}

function assertActor(actor: string): void {
  if (!actorName.test(actor)) {
    throw new RequestError("actor must be 1 to 80 letters, digits, spaces, dots, underscores or dashes.");
  }
}

function assertIntent(intent: string): void {
  const trimmed = intent.trim();
  if (trimmed.length < 8 || trimmed.length > 4000) {
    throw new RequestError("intent must be between 8 and 4000 characters.");
  }
}

function parseEnvelope(text: string, skill: string): Envelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new GuardrailError(`${skill} output is not JSON.`);
  }
  const result = envelopeSchema.safeParse(parsed);
  if (!result.success) {
    throw new GuardrailError(`${skill} output is missing a summary or an artifact.`);
  }
  return result.data;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}

function readForcedKind(raw: string | undefined): ProviderKind | undefined {
  if (!raw || !raw.trim()) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "mock" || value === "openai-compatible") return value;
  throw new RequestError("DLC_PROVIDER must be mock or openai-compatible.");
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/runtime/orchestrator.ts";
