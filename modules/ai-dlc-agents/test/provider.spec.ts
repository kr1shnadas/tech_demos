/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { MockProvider } from "../src/provider/mock.js";
import { OpenAiCompatibleProvider } from "../src/provider/openai-compatible.js";
import type { ModelRequest } from "../src/provider/types.js";

const request: ModelRequest = {
  modelId: "mock-deterministic",
  systemPrompt: "You write notes.",
  prompt: "Write a note for the desk",
  maxTokens: 2000,
  skill: "requirements-to-stories",
  input: { intent: "Build a NestJS CRUD service for library books", prior: {} },
};

describe("model providers", () => {
  it("returns the same text for the same skill and input", async () => {
    const provider = new MockProvider();
    const first = await provider.complete(request);
    const second = await provider.complete(request);
    expect(first).toEqual(second);
    expect(first.truncated).toBe(false);
    const body = JSON.parse(first.text) as { artifact: { entity: string; units: unknown[] } };
    expect(body.artifact.entity).toBe("Book");
    expect(body.artifact.units).toHaveLength(3);
  });

  it("refuses when the token budget is smaller than the reply", async () => {
    const provider = new MockProvider();
    const reply = await provider.complete({ ...request, maxTokens: 1 });
    expect(reply.truncated).toBe(true);
    expect(reply.text).toBe("");
    expect(reply.tokensUsed).toBeGreaterThan(1);
  });

  it("posts to a chat completions endpoint and reads the message", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "{\"summary\":\"ok\",\"artifact\":{\"skill\":\"write-note\",\"intent\":\"x\"}}" } }],
          usage: { total_tokens: 12 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const provider = new OpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1/",
      apiKey: "test-key",
      timeoutMs: 1000,
      fetchImpl,
    });
    const reply = await provider.complete({ ...request, modelId: "desk-model", skill: "write-note" });
    expect(reply.tokensUsed).toBe(12);
    expect(reply.text).toContain("write-note");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.test/v1/chat/completions");
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-key");
    const body = JSON.parse(String(calls[0]?.init.body)) as { model: string; temperature: number };
    expect(body.model).toBe("desk-model");
    expect(body.temperature).toBe(0);
  });

  it("fails closed when the API key is missing", async () => {
    const provider = new OpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "",
      timeoutMs: 1000,
      fetchImpl: async () => new Response("nope", { status: 500 }),
    });
    await expect(provider.complete(request)).rejects.toThrow(/API key/);
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#test/provider.spec.ts";
