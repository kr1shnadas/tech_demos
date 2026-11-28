/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { z } from "zod";
import { ConfigError } from "../runtime/errors.js";

export const phaseOrder = ["inception", "construction", "operations"] as const;

const nameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,48}$/, "must be a lowercase name of up to 49 characters");

const propertySchema = z
  .object({
    type: z.enum(["string", "number", "boolean", "object", "array"]),
    description: z.string().max(200).optional(),
  })
  .strict();

const objectSchemaSchema = z
  .object({
    type: z.literal("object"),
    description: z.string().max(200).optional(),
    required: z
      .array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/, "must be a field name"))
      .max(40)
      .optional(),
    properties: z.record(
      z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/, "must be a field name"),
      propertySchema,
    ),
  })
  .strict()
  .superRefine((schema, ctx) => {
    for (const key of schema.required ?? []) {
      if (!schema.properties[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `required field ${key} is not in properties.`,
        });
      }
    }
  });

const toolSchema = z.enum(["write_file", "read_file", "list_files"]);

const skillSchema = z
  .object({
    name: nameSchema,
    description: z.string().min(1).max(500),
    whenToUse: z.string().min(1).max(500),
    inputSchema: objectSchemaSchema,
    outputSchema: objectSchemaSchema,
    promptTemplate: z.string().min(1).max(8000),
    allowedTools: z.array(toolSchema).max(3),
  })
  .strict();

const guardrailsSchema = z
  .object({
    allowedPaths: z
      .array(z.string().regex(/^[a-z][a-z0-9-]{0,30}$/, "must be a single path segment"))
      .min(1)
      .max(20),
    maxTokens: z.number().int().min(1).max(128000),
    maxSteps: z.number().int().min(1).max(100),
  })
  .strict();

const providerKindSchema = z.enum(["mock", "openai-compatible"]);

const agentSchema = z
  .object({
    name: nameSchema,
    role: z.string().min(1).max(80),
    provider: providerKindSchema,
    modelId: z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/, "must be a model id"),
    systemPrompt: z.string().min(1).max(4000),
    skills: z.array(nameSchema).min(1).max(20),
    guardrails: guardrailsSchema,
  })
  .strict();

const phaseSchema = z
  .object({
    phase: z.enum(phaseOrder),
    agent: nameSchema,
    skills: z.array(nameSchema).min(1).max(20),
    approvalGate: z.boolean(),
  })
  .strict();

const workflowSchema = z
  .object({
    name: nameSchema,
    description: z.string().min(1).max(500),
    outputDir: z
      .string()
      .regex(/^[a-z0-9][a-z0-9/_-]{0,80}$/, "must be a relative directory")
      .refine((value) => !value.split("/").includes(".."), "must not contain .."),
    phases: z.array(phaseSchema).length(3),
  })
  .strict();

const profileSchema = z
  .object({
    description: z.string().min(1).max(500),
    auditLogging: z.boolean(),
    approval: z.enum(["every-phase", "as-configured"]),
  })
  .strict();

const providerSchema = z
  .object({
    kind: providerKindSchema,
    modelId: z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/, "must be a model id"),
    baseUrl: z
      .string()
      .url()
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "must be an http(s) URL"),
    apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]{0,60}$/, "must be an environment variable name"),
    timeoutMs: z.number().int().min(100).max(120000),
  })
  .strict();

const healthSchema = z
  .object({
    livenessPath: z.string(),
    readinessPath: z.string(),
  })
  .strict();

export const kitSchema = z
  .object({
    profile: nameSchema,
    profiles: z.record(nameSchema, profileSchema),
    skills: z.array(skillSchema).max(40),
    agents: z.array(agentSchema).max(20),
    workflows: z.array(workflowSchema).max(20),
    provider: providerSchema,
    outputRoot: z.string().min(1).max(200),
    health: healthSchema,
  })
  .strict()
  .superRefine((config, ctx) => {
    refineKit(config, ctx);
  });

const documentSchema = z
  .object({
    profile: nameSchema.optional(),
    profiles: z.record(nameSchema, profileSchema).optional(),
    skills: z.array(skillSchema).max(40).optional(),
    agents: z.array(agentSchema).max(20).optional(),
    workflows: z.array(workflowSchema).max(20).optional(),
    provider: providerSchema.partial().optional(),
    outputRoot: z.string().min(1).max(200).optional(),
    health: healthSchema.partial().optional(),
  })
  .strict();

export type PhaseName = (typeof phaseOrder)[number];
export type ToolName = z.infer<typeof toolSchema>;
export type PropertySchema = z.infer<typeof propertySchema>;
export type ObjectSchema = z.infer<typeof objectSchemaSchema>;
export type SkillSpec = z.infer<typeof skillSchema>;
export type Guardrails = z.infer<typeof guardrailsSchema>;
export type ProviderKind = z.infer<typeof providerKindSchema>;
export type AgentSpec = z.infer<typeof agentSchema>;
export type PhaseSpec = z.infer<typeof phaseSchema>;
export type WorkflowSpec = z.infer<typeof workflowSchema>;
export type ApprovalPolicy = z.infer<typeof profileSchema>["approval"];
export type ProfileSpec = z.infer<typeof profileSchema>;
export type ProviderSettings = z.infer<typeof providerSchema>;
export type HealthPaths = z.infer<typeof healthSchema>;
export type KitConfig = z.infer<typeof kitSchema>;

export interface KitDocument {
  profile?: string;
  profiles?: Record<string, ProfileSpec>;
  skills?: SkillSpec[];
  agents?: AgentSpec[];
  workflows?: WorkflowSpec[];
  provider?: Partial<ProviderSettings>;
  outputRoot?: string;
  health?: Partial<HealthPaths>;
}

export const defaultKitConfig: KitConfig = {
  profile: "startup",
  profiles: {
    regulated: {
      description: "Audit every step and require a person to approve each phase.",
      auditLogging: true,
      approval: "every-phase",
    },
    startup: {
      description: "Keep an audit log and stop only where the workflow asks for a person.",
      auditLogging: true,
      approval: "as-configured",
    },
  },
  skills: [],
  agents: [],
  workflows: [],
  provider: {
    kind: "mock",
    modelId: "mock-deterministic",
    baseUrl: "http://127.0.0.1:8080/v1",
    apiKeyEnv: "DLC_PROVIDER_API_KEY",
    timeoutMs: 30000,
  },
  outputRoot: "output",
  health: {
    livenessPath: "/health/live",
    readinessPath: "/health/ready",
  },
};

/**
 * Merges a document onto the defaults and validates it.
 * Nested `provider` and `health` merge field by field. A `profiles` entry replaces
 * that profile. `skills`, `agents` and `workflows` replace the default lists when set.
 */
export function defineKitConfig(overrides: unknown = {}): KitConfig {
  let document: z.infer<typeof documentSchema>;
  try {
    document = documentSchema.parse(overrides);
  } catch (error) {
    throw asConfigError(error);
  }
  const merged: KitConfig = {
    profile: document.profile ?? defaultKitConfig.profile,
    profiles: { ...defaultKitConfig.profiles, ...document.profiles },
    skills: document.skills ?? [],
    agents: document.agents ?? [],
    workflows: document.workflows ?? [],
    provider: { ...defaultKitConfig.provider, ...defined(document.provider ?? {}) },
    outputRoot: document.outputRoot ?? defaultKitConfig.outputRoot,
    health: { ...defaultKitConfig.health, ...defined(document.health ?? {}) },
  };
  return assertKitConfig(merged);
}

export function assertKitConfig(config: KitConfig): KitConfig {
  try {
    return kitSchema.parse(config);
  } catch (error) {
    throw asConfigError(error);
  }
}

function asConfigError(error: unknown): ConfigError {
  if (error instanceof ConfigError) return error;
  if (error instanceof z.ZodError) return new ConfigError(formatIssue(error));
  if (error instanceof Error) return new ConfigError(error.message);
  return new ConfigError("config is invalid.");
}

function formatIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "config is invalid.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function defined<T extends object>(overrides: T): Partial<T> {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function refineKit(config: KitConfig, ctx: z.RefinementCtx): void {
  if (!config.profiles.regulated) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["profiles", "regulated"],
      message: "is required.",
    });
  } else {
    if (config.profiles.regulated.auditLogging !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profiles", "regulated", "auditLogging"],
        message: "requires audit logging.",
      });
    }
    if (config.profiles.regulated.approval !== "every-phase") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profiles", "regulated", "approval"],
        message: "requires approval on every phase.",
      });
    }
  }
  if (!config.profiles.startup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["profiles", "startup"],
      message: "is required.",
    });
  }
  if (!config.profiles[config.profile]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["profile"],
      message: `${config.profile} is not defined.`,
    });
  }
  assertOutputRoot(config.outputRoot, ctx);
  assertHealth(config.health, ctx);

  const skills = new Map<string, SkillSpec>();
  for (const skill of config.skills) {
    if (skills.has(skill.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skills"],
        message: `skill ${skill.name} is listed twice.`,
      });
    }
    skills.set(skill.name, skill);
    if (new Set(skill.allowedTools).size !== skill.allowedTools.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skills"],
        message: `skill ${skill.name} lists a tool twice.`,
      });
    }
    if (!skill.promptTemplate.includes("{{intent}}")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skills"],
        message: `skill ${skill.name} prompt must include {{intent}}.`,
      });
    }
  }

  const agents = new Map<string, AgentSpec>();
  for (const agent of config.agents) {
    if (agents.has(agent.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agents"],
        message: `agent ${agent.name} is listed twice.`,
      });
    }
    agents.set(agent.name, agent);
    if (new Set(agent.skills).size !== agent.skills.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agents"],
        message: `agent ${agent.name} lists a skill twice.`,
      });
    }
    for (const skillName of agent.skills) {
      if (!skills.has(skillName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["agents"],
          message: `agent ${agent.name} names unknown skill ${skillName}.`,
        });
      }
    }
    if (new Set(agent.guardrails.allowedPaths).size !== agent.guardrails.allowedPaths.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agents"],
        message: `agent ${agent.name} lists an allowed path twice.`,
      });
    }
  }

  const workflows = new Set<string>();
  for (const workflow of config.workflows) {
    if (workflows.has(workflow.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workflows"],
        message: `workflow ${workflow.name} is listed twice.`,
      });
    }
    workflows.add(workflow.name);
    workflow.phases.forEach((phase, index) => {
      if (phase.phase !== phaseOrder[index]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workflows"],
          message: `workflow ${workflow.name} must list inception, construction and operations in that order.`,
        });
      }
      const agent = agents.get(phase.agent);
      if (!agent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workflows"],
          message: `workflow ${workflow.name} names unknown agent ${phase.agent}.`,
        });
        return;
      }
      if (new Set(phase.skills).size !== phase.skills.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workflows"],
          message: `phase ${phase.phase} lists a skill twice.`,
        });
      }
      for (const skillName of phase.skills) {
        if (!agent.skills.includes(skillName)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["workflows"],
            message: `phase ${phase.phase} uses skill ${skillName}, which is not assigned to ${agent.name}.`,
          });
        }
      }
    });
  }
}

function assertOutputRoot(value: string, ctx: z.RefinementCtx): void {
  if (value.includes("\0") || value.split(/[\\/]/).includes("..")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["outputRoot"],
      message: "must not contain ..",
    });
  }
}

function assertHealth(health: HealthPaths, ctx: z.RefinementCtx): void {
  assertPath(health.livenessPath, ["health", "livenessPath"], ctx);
  assertPath(health.readinessPath, ["health", "readinessPath"], ctx);
  if (health.livenessPath === health.readinessPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["health"],
      message: "health paths must be distinct.",
    });
  }
}

function assertPath(value: string, path: (string | number)[], ctx: z.RefinementCtx): void {
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(value) || value.length > 80) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "must be a path starting with /.",
    });
    return;
  }
  if (value === "/" || value.startsWith("/api")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "must not cover the page or the API.",
    });
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/config/kit-config.ts";
