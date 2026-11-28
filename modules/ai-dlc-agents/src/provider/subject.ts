/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface Subject {
  entity: string;
  plural: string;
  resource: string;
}

/**
 * Picks a noun from "… for library books" so the same intent always yields the same type name.
 * The result is a TypeScript identifier. Anything that is not a plain word becomes "Item".
 */
export function subjectFromIntent(intent: string): Subject {
  const match = intent.match(/\bfor\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9 -]{0,80})/i);
  const phrase = (match?.[1] ?? "item").replace(/\b(service|api|module|crud)\b/gi, " ");
  const words = phrase
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const noun = words[words.length - 1] ?? "item";
  const entity = toPascal(singular(noun));
  const safeEntity = /^[A-Z][A-Za-z0-9]{0,40}$/.test(entity) ? entity : "Item";
  const plural = pluralize(safeEntity);
  return { entity: safeEntity, plural, resource: plural.toLowerCase() };
}

function singular(word: string): string {
  const lower = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!lower) return "item";
  if (lower.endsWith("ies") && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/.test(lower) && lower.length > 4) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) return lower.slice(0, -1);
  return lower;
}

function pluralize(pascal: string): string {
  if (/[^aeiou]y$/i.test(pascal)) return `${pascal.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(pascal)) return `${pascal}es`;
  return `${pascal}s`;
}

function toPascal(word: string): string {
  const clean = word.replace(/[^A-Za-z0-9]/g, "");
  if (!clean) return "Item";
  return clean.slice(0, 1).toUpperCase() + clean.slice(1).toLowerCase();
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/provider/subject.ts";
