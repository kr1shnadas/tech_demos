/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class SchemaMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaMatchError";
  }
}

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

export class GuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailError";
  }
}

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

export class RunNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunNotFoundError";
  }
}

export class RequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestError";
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/runtime/errors.ts";
