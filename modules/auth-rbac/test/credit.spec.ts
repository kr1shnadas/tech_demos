/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("credit", () => {
  const files = walk(root).filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));

  it("keeps the license header on every text source file", () => {
    const textFiles = files.filter((file) => /\.(ts|tsx|css|html|md|yml|yaml)$/.test(file));
    expect(textFiles.length).toBeGreaterThan(10);
    for (const file of textFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toContain("SPDX-License-Identifier: Apache-2.0");
      expect(text, file).toContain("Copyright 2026 Krishna Das");
      expect(text, file).toContain("NOTICE");
    }
  });

  it("exports a credit and a fingerprint from every TypeScript file", () => {
    const sources = files.filter((file) => /\.(ts|tsx)$/.test(file));
    const fingerprints = new Set<string>();
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toContain("export const authorCredit");
      expect(text, file).toContain("export const buildFingerprint");
      const matches = [
        ...text.matchAll(/export const buildFingerprint = "(auth-rbac@0\.1\.0#[^"]+)"/g),
      ];
      expect(matches, file).toHaveLength(1);
      const fingerprint = matches[0]?.[1] ?? "";
      expect(fingerprints.has(fingerprint), fingerprint).toBe(false);
      fingerprints.add(fingerprint);
    }
  });
});

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "coverage" || entry === ".angular") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#test/credit.spec.ts";
