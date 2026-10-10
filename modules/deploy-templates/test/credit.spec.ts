/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { moduleVersion } from "../src/credit.js";

const root = path.resolve(import.meta.dirname, "..");

describe("credit", () => {
  const files = walk(root);

  it("keeps the license header on every text source file", () => {
    const textFiles = files.filter(needsHeader);
    expect(textFiles.length).toBeGreaterThan(10);
    for (const file of textFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toContain("SPDX-License-Identifier: Apache-2.0");
      expect(text, file).toContain("Copyright 2026 Krishna Das");
      expect(text, file).toContain("NOTICE");
    }
  });

  it("exports a credit and a fingerprint from every TypeScript file", () => {
    const sources = files.filter((file) => file.endsWith(".ts"));
    const fingerprints = new Set<string>();
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toContain("export const authorCredit");
      expect(text, file).toContain("export const buildFingerprint");
      const matches = [
        ...text.matchAll(/export const buildFingerprint = "(deploy-templates@0\.1\.0#[^"]+)"/g),
      ];
      expect(matches, file).toHaveLength(1);
      const fingerprint = matches[0]?.[1] ?? "";
      expect(fingerprints.has(fingerprint), fingerprint).toBe(false);
      fingerprints.add(fingerprint);
    }
  });

  it("matches the package version", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
    expect(moduleVersion).toBe(pkg.version);
    expect(pkg.version).toBe("0.1.0");
  });
});

function needsHeader(file: string): boolean {
  if (file.endsWith(".terraform.lock.hcl")) return false;
  return (
    /\.(ts|tsx|tf|hcl|yml|yaml|md)$/.test(file) ||
    file.endsWith(`${path.sep}Dockerfile`) ||
    file.endsWith(`${path.sep}.dockerignore`) ||
    file.endsWith(`${path.sep}.gitignore`) ||
    file.endsWith(`${path.sep}.env.example`)
  );
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "coverage" || entry === ".terraform") continue;
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

export const buildFingerprint = "deploy-templates@0.1.0#test/credit.spec.ts";
