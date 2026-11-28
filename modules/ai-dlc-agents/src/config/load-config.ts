/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { defineKitConfig, type KitConfig, type KitDocument } from "./kit-config.js";
import { ConfigError } from "../runtime/errors.js";

export interface LoadOptions {
  /** YAML or JSON file. Omit it to build from the defaults and the environment. */
  path?: string;
  /** Defaults to `process.env`. A `.env` file is read only in that case. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Loads a kit document from YAML or JSON, then applies environment overrides.
 * Unset variables keep the file, and the file keeps the defaults from `defineKitConfig`.
 * When this reads `process.env` and a `.env` file is present, values already
 * set in the environment win.
 */
export function loadKitConfig(options: LoadOptions = {}): KitConfig {
  const env = options.env ?? process.env;
  if (env === process.env) loadEnvFile();
  const document = options.path ? readDocument(options.path) : {};
  return defineKitConfig(applyEnv(document, env));
}

export function loadEnvFile(file = ".env"): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function readDocument(file: string): KitDocument {
  const abs = path.resolve(file);
  if (!existsSync(abs)) throw new ConfigError(`config file ${file} was not found.`);
  const text = readFileSync(abs, "utf8");
  const ext = path.extname(abs).toLowerCase();
  let parsed: unknown;
  try {
    if (ext === ".yaml" || ext === ".yml") parsed = parseYaml(text);
    else if (ext === ".json") parsed = JSON.parse(text) as unknown;
    else throw new ConfigError("config file must be .yaml, .yml or .json.");
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(`config file ${file} could not be parsed.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError("config file must contain an object.");
  }
  return parsed as KitDocument;
}

function applyEnv(document: KitDocument, env: NodeJS.ProcessEnv): KitDocument {
  const next: KitDocument = { ...document };
  if (present(env.DLC_PROFILE)) next.profile = env.DLC_PROFILE.trim();
  if (present(env.DLC_OUTPUT_ROOT)) next.outputRoot = env.DLC_OUTPUT_ROOT.trim();

  const provider: NonNullable<KitDocument["provider"]> = { ...document.provider };
  let providerSet = document.provider !== undefined;
  if (present(env.DLC_PROVIDER)) {
    provider.kind = readKind(env.DLC_PROVIDER);
    providerSet = true;
  }
  if (present(env.DLC_PROVIDER_BASE_URL)) {
    provider.baseUrl = env.DLC_PROVIDER_BASE_URL.trim();
    providerSet = true;
  }
  if (present(env.DLC_MODEL)) {
    provider.modelId = env.DLC_MODEL.trim();
    providerSet = true;
  }
  if (present(env.DLC_PROVIDER_API_KEY_ENV)) {
    provider.apiKeyEnv = env.DLC_PROVIDER_API_KEY_ENV.trim();
    providerSet = true;
  }
  if (present(env.DLC_PROVIDER_TIMEOUT_MS)) {
    provider.timeoutMs = readInt("DLC_PROVIDER_TIMEOUT_MS", env.DLC_PROVIDER_TIMEOUT_MS);
    providerSet = true;
  }
  if (providerSet) next.provider = provider;

  const health: NonNullable<KitDocument["health"]> = { ...document.health };
  let healthSet = document.health !== undefined;
  if (present(env.DLC_LIVENESS_PATH)) {
    health.livenessPath = env.DLC_LIVENESS_PATH.trim();
    healthSet = true;
  }
  if (present(env.DLC_READINESS_PATH)) {
    health.readinessPath = env.DLC_READINESS_PATH.trim();
    healthSet = true;
  }
  if (healthSet) next.health = health;
  return next;
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function readInt(name: string, raw: string): number {
  const value = raw.trim();
  if (!/^-?\d+$/.test(value)) throw new ConfigError(`${name} must be an integer.`);
  return Number(value);
}

function readKind(raw: string): "mock" | "openai-compatible" {
  const value = raw.trim().toLowerCase();
  if (value === "mock" || value === "openai-compatible") return value;
  throw new ConfigError("DLC_PROVIDER must be mock or openai-compatible.");
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/config/load-config.ts";
