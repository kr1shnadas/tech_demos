/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ObjectSchema, PropertySchema } from "./kit-config.js";
import { SchemaMatchError } from "../runtime/errors.js";

/**
 * Checks a skill input or artifact against the small schema stored in the config.
 * One object level: required keys, and a type for each declared property.
 */
export function assertMatchesSchema(value: unknown, schema: ObjectSchema, label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SchemaMatchError(`${label} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  for (const key of schema.required ?? []) {
    if (record[key] === undefined || record[key] === null) {
      throw new SchemaMatchError(`${label}.${key} is required.`);
    }
  }
  for (const [key, property] of Object.entries(schema.properties)) {
    if (record[key] === undefined) continue;
    if (!matches(record[key], property)) {
      throw new SchemaMatchError(`${label}.${key} must be a ${property.type}.`);
    }
  }
}

function matches(value: unknown, property: PropertySchema): boolean {
  switch (property.type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    default:
      return false;
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/config/match-schema.ts";
