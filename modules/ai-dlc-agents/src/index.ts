/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { moduleVersion } from "./credit.js";
export {
  assertKitConfig,
  defaultKitConfig,
  defineKitConfig,
  kitSchema,
  phaseOrder,
  type AgentSpec,
  type ApprovalPolicy,
  type Guardrails,
  type HealthPaths,
  type KitConfig,
  type KitDocument,
  type ObjectSchema,
  type PhaseName,
  type PhaseSpec,
  type ProfileSpec,
  type PropertySchema,
  type ProviderKind,
  type ProviderSettings,
  type SkillSpec,
  type ToolName,
  type WorkflowSpec,
} from "./config/kit-config.js";
export { loadEnvFile, loadKitConfig, type LoadOptions } from "./config/load-config.js";
export { assertMatchesSchema } from "./config/match-schema.js";
export { createProvider } from "./provider/create.js";
export { MockProvider } from "./provider/mock.js";
export { OpenAiCompatibleProvider, type OpenAiCompatibleOptions } from "./provider/openai-compatible.js";
export { subjectFromIntent, type Subject } from "./provider/subject.js";
export {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type SkillInput,
} from "./provider/types.js";
export { AuditLog, fileAuditSink, type AuditDraft, type AuditEntry, type AuditLogOptions } from "./runtime/audit-log.js";
export {
  ApprovalError,
  ConfigError,
  GuardrailError,
  PathGuardError,
  RequestError,
  RunNotFoundError,
  SchemaMatchError,
} from "./runtime/errors.js";
export { canonical, sha256 } from "./runtime/hash.js";
export {
  WorkflowOrchestrator,
  renderTemplate,
  type OrchestratorOptions,
  type PhaseState,
  type PhaseStatus,
  type RunStatus,
  type StartRequest,
  type StepRecord,
  type WorkflowRun,
} from "./runtime/orchestrator.js";
export { listSandboxed, readSandboxed, resolveSandboxed, writeSandboxed } from "./runtime/path-guard.js";
export { LifecycleModule, type LifecycleModuleOptions } from "./nest/lifecycle.module.js";
export { KIT_CONFIG, ORCHESTRATOR } from "./nest/tokens.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/index.ts";
