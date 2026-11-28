/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { KitConfig, ProviderKind } from "../config/kit-config.js";
import { MockProvider } from "./mock.js";
import { OpenAiCompatibleProvider } from "./openai-compatible.js";
import type { ModelProvider } from "./types.js";

export function createProvider(
  kind: ProviderKind,
  config: KitConfig,
  env: NodeJS.ProcessEnv = {},
  fetchImpl?: typeof fetch,
): ModelProvider {
  if (kind === "mock") return new MockProvider();
  const apiKey = env[config.provider.apiKeyEnv] ?? "";
  return new OpenAiCompatibleProvider({
    baseUrl: config.provider.baseUrl,
    apiKey,
    timeoutMs: config.provider.timeoutMs,
    fetchImpl,
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/provider/create.ts";
