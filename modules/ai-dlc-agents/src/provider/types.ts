/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ProviderKind } from "../config/kit-config.js";

export interface SkillInput {
  intent: string;
  prior: Record<string, unknown>;
}

export interface ModelRequest {
  modelId: string;
  systemPrompt: string;
  prompt: string;
  maxTokens: number;
  skill: string;
  input: SkillInput;
}

export interface ModelResponse {
  text: string;
  tokensUsed: number;
  truncated: boolean;
}

export interface ModelProvider {
  readonly kind: ProviderKind;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/provider/types.ts";
