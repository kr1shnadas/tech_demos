/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ModelProvider, ModelRequest, ModelResponse, SkillInput } from "./types.js";
import { subjectFromIntent } from "./subject.js";
import { buildNestModule, buildServiceTest, domainFromSubject, type DomainModel } from "./nest-files.js";

/**
 * Offline provider. The same skill and the same input always return the same text.
 * It does not open a socket and it does not read an API key. The demo and the tests use it.
 */
export class MockProvider implements ModelProvider {
  readonly kind = "mock" as const;

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const text = render(request);
    const tokensUsed = Math.max(1, Math.ceil(text.length / 4));
    if (tokensUsed > request.maxTokens) {
      return { text: "", tokensUsed, truncated: true };
    }
    return { text, tokensUsed, truncated: false };
  }
}

function render(request: ModelRequest): string {
  const input = request.input;
  switch (request.skill) {
    case "requirements-to-stories":
      return JSON.stringify(stories(input));
    case "domain-model":
      return JSON.stringify(domain(input));
    case "generate-nest-module":
      return JSON.stringify(nestModule(input));
    case "generate-tests":
      return JSON.stringify(tests(input));
    case "review-diff":
      return JSON.stringify(review(input));
    default:
      return JSON.stringify({
        summary: `Recorded ${request.skill}.`,
        artifact: { skill: request.skill, intent: input.intent },
      });
  }
}

function stories(input: SkillInput): unknown {
  const subject = subjectFromIntent(input.intent);
  const units = [
    {
      id: "U1",
      title: `Create a ${subject.entity}`,
      statement: `A person can create a ${subject.entity}.`,
    },
    {
      id: "U2",
      title: `Read a ${subject.entity}`,
      statement: `A person can list ${subject.plural} and read one of them.`,
    },
    {
      id: "U3",
      title: `Change a ${subject.entity}`,
      statement: `A person can update or delete a ${subject.entity}.`,
    },
  ];
  return {
    summary: `${units.length} units of work for ${subject.entity}.`,
    artifact: { entity: subject.entity, units },
  };
}

function domain(input: SkillInput): unknown {
  const model = readDomain(input);
  return {
    summary: `${model.entity} with ${model.fields.length} fields.`,
    artifact: model,
  };
}

function nestModule(input: SkillInput): unknown {
  const model = readDomain(input);
  const files = buildNestModule(model);
  return {
    summary: `Wrote ${files.length} files for ${model.entity}.`,
    artifact: { entity: model.entity, files: files.map((file) => file.path) },
    files,
  };
}

function tests(input: SkillInput): unknown {
  const model = readDomain(input);
  const file = buildServiceTest(model);
  return {
    summary: `Wrote a service test for ${model.entity}.`,
    artifact: { entity: model.entity, files: [file.path] },
    files: [file],
  };
}

function review(input: SkillInput): unknown {
  const files = collectFiles(input.prior);
  const notes = [
    files.length > 0 ? `${files.length} files are in the sandbox.` : "No files were written yet.",
    "A person still has to accept this phase.",
  ];
  const body = `# Review\n\nVerdict: accept\n\n${files.map((file) => `- ${file}`).join("\n")}\n`;
  return {
    summary: `Reviewed ${files.length} files.`,
    artifact: { verdict: "accept", files, notes },
    files: [{ path: "docs/review.md", contents: body }],
    toolCalls: [{ tool: "list_files" }],
  };
}

function readDomain(input: SkillInput): DomainModel {
  const prior = input.prior["domain-model"];
  if (prior && typeof prior === "object" && !Array.isArray(prior)) {
    const record = prior as Partial<DomainModel>;
    if (
      typeof record.entity === "string" &&
      typeof record.plural === "string" &&
      typeof record.resource === "string" &&
      Array.isArray(record.fields)
    ) {
      return record as DomainModel;
    }
  }
  return domainFromSubject(subjectFromIntent(input.intent));
}

function collectFiles(prior: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (const value of Object.values(prior)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const files = (value as { files?: unknown }).files;
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      if (typeof file === "string") paths.push(file);
    }
  }
  return paths;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/provider/mock.ts";
