/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultKitConfig, defineKitConfig } from "../src/config/kit-config.js";
import { loadKitConfig } from "../src/config/load-config.js";
import { assertMatchesSchema } from "../src/config/match-schema.js";

const example = path.resolve(import.meta.dirname, "../examples/nestjs-crud.yaml");

describe("kit config", () => {
  it("starts from the startup profile and the offline provider", () => {
    const config = defineKitConfig();
    expect(config.profile).toBe("startup");
    expect(config.profiles.startup.approval).toBe("as-configured");
    expect(config.profiles.regulated).toEqual(defaultKitConfig.profiles.regulated);
    expect(config.profiles.regulated.auditLogging).toBe(true);
    expect(config.profiles.regulated.approval).toBe("every-phase");
    expect(config.provider).toEqual(defaultKitConfig.provider);
    expect(config.outputRoot).toBe("output");
    expect(config.skills).toEqual([]);
    expect(config.workflows).toEqual([]);
    expect(config.health).toEqual({ livenessPath: "/health/live", readinessPath: "/health/ready" });
  });

  it("loads the NestJS CRUD example", () => {
    const config = loadKitConfig({ path: example, env: {} });
    expect(config.profile).toBe("startup");
    expect(config.skills.map((skill) => skill.name)).toEqual([
      "requirements-to-stories",
      "domain-model",
      "generate-nest-module",
      "generate-tests",
      "review-diff",
    ]);
    expect(config.agents.map((agent) => agent.name)).toEqual(["analyst", "builder", "reviewer"]);
    expect(config.workflows[0]?.name).toBe("nestjs-crud");
    expect(config.workflows[0]?.phases.map((phase) => phase.phase)).toEqual([
      "inception",
      "construction",
      "operations",
    ]);
    expect(config.provider.kind).toBe("mock");
  });

  it("reads JSON and lets the environment override the file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kit-config-"));
    const file = path.join(dir, "kit.json");
    writeFileSync(file, JSON.stringify({ profile: "startup", outputRoot: "from-file" }));
    const config = loadKitConfig({
      path: file,
      env: {
        DLC_PROFILE: "regulated",
        DLC_PROVIDER: "openai-compatible",
        DLC_PROVIDER_BASE_URL: "https://example.test/v1",
        DLC_MODEL: "mock-deterministic",
        DLC_OUTPUT_ROOT: "from-env",
      },
    });
    expect(config.profile).toBe("regulated");
    expect(config.outputRoot).toBe("from-env");
    expect(config.provider.kind).toBe("openai-compatible");
    expect(config.provider.baseUrl).toBe("https://example.test/v1");
    expect(config.provider.modelId).toBe("mock-deterministic");
    expect(config.provider.apiKeyEnv).toBe(defaultKitConfig.provider.apiKeyEnv);
  });

  it("rejects a regulated profile that turns the audit log off", () => {
    expect(() =>
      defineKitConfig({
        profiles: {
          regulated: {
            description: "Broken regulated profile.",
            auditLogging: false,
            approval: "every-phase",
          },
        },
      }),
    ).toThrow(/requires audit logging/);
  });

  it("rejects a regulated profile that skips a gate", () => {
    expect(() =>
      defineKitConfig({
        profiles: {
          regulated: {
            description: "Broken regulated profile.",
            auditLogging: true,
            approval: "as-configured",
          },
        },
      }),
    ).toThrow(/requires approval on every phase/);
  });

  it("rejects an agent that names a skill it was not given", () => {
    const config = loadKitConfig({ path: example, env: {} });
    expect(() =>
      defineKitConfig({
        ...config,
        workflows: [
          {
            ...config.workflows[0]!,
            phases: config.workflows[0]!.phases.map((phase) =>
              phase.phase === "inception" ? { ...phase, skills: ["domain-model"] } : phase,
            ),
          },
        ],
      }),
    ).toThrow(/not assigned to analyst/);
  });

  it("rejects a prompt that drops the intent placeholder", () => {
    const config = loadKitConfig({ path: example, env: {} });
    const [first, ...rest] = config.skills;
    expect(() =>
      defineKitConfig({
        ...config,
        skills: [{ ...first!, promptTemplate: "No placeholder here." }, ...rest],
      }),
    ).toThrow(/must include \{\{intent\}\}/);
  });

  it("rejects a provider kind the environment does not know", () => {
    expect(() => loadKitConfig({ env: { DLC_PROVIDER: "somewhere" } })).toThrow(/DLC_PROVIDER/);
  });

  it("checks a skill payload against its schema", () => {
    const config = loadKitConfig({ path: example, env: {} });
    const skill = config.skills[0]!;
    expect(() => assertMatchesSchema({ entity: "Book" }, skill.outputSchema, "output")).toThrow(/units is required/);
    expect(() =>
      assertMatchesSchema({ entity: "Book", units: [] }, skill.outputSchema, "output"),
    ).not.toThrow();
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/config.spec.ts";
