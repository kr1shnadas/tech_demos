/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ModelProvider, ModelRequest, ModelResponse } from "./types.js";

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
  usage?: { total_tokens?: unknown };
}

/**
 * Talks to any server that implements the chat completions HTTP shape.
 * The key stays in memory for the request. It is not written to the audit log.
 */
export class OpenAiCompatibleProvider implements ModelProvider {
  readonly kind = "openai-compatible" as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiCompatibleOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    if (!this.options.apiKey) {
      throw new Error("The model provider API key is not set.");
    }
    const url = `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: request.modelId,
        temperature: 0,
        max_tokens: request.maxTokens,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.prompt },
        ],
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`model provider returned ${response.status}.`);
    }
    const body = (await response.json()) as ChatResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("model provider returned an empty completion.");
    }
    const reported = body.usage?.total_tokens;
    const tokensUsed = typeof reported === "number" && Number.isFinite(reported)
      ? reported
      : Math.max(1, Math.ceil(content.length / 4));
    return {
      text: content,
      tokensUsed,
      truncated: tokensUsed > request.maxTokens,
    };
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/provider/openai-compatible.ts";
