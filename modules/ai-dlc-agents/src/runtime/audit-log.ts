/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  runId: string;
  workflow: string;
  phase?: string;
  skill?: string;
  inputHash: string;
  outputHash: string;
}

export type AuditDraft = Omit<AuditEntry, "seq" | "at">;

export interface AuditLogOptions {
  now?: () => Date;
  sink?: (entry: AuditEntry) => void;
}

/**
 * Append-only log. There is no update and no delete. `list` returns a copy,
 * and each entry is frozen so a caller cannot rewrite history in place.
 */
export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly now: () => Date;
  private readonly sink?: (entry: AuditEntry) => void;

  constructor(options: AuditLogOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.sink = options.sink;
  }

  append(draft: AuditDraft): AuditEntry {
    const entry = Object.freeze({
      ...draft,
      seq: this.entries.length + 1,
      at: this.now().toISOString(),
    });
    this.entries.push(entry);
    this.sink?.(entry);
    return entry;
  }

  list(): readonly AuditEntry[] {
    return [...this.entries];
  }
}

/** Appends one JSON line per entry. The file is never rewritten. */
export function fileAuditSink(file: string): (entry: AuditEntry) => void {
  mkdirSync(path.dirname(file), { recursive: true });
  return (entry) => {
    appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  };
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/runtime/audit-log.ts";
