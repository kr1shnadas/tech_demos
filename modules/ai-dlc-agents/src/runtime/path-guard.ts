/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PathGuardError } from "./errors.js";

/**
 * Resolves `relativePath` inside `root` and checks the first segment against `allowed`.
 * `allowed` entries are single path segments (`src`, `test`, `docs`). A write under
 * `src/books/books.service.ts` is allowed when `src` is in the list. `..`, absolute
 * paths and a prefix the role was not given are refused.
 */
export function resolveSandboxed(root: string, relativePath: string, allowed: readonly string[]): string {
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\")) {
    throw new PathGuardError("path is empty or contains a forbidden character.");
  }
  if (path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new PathGuardError("path must stay inside the output directory.");
  }
  const normalized = path.posix.normalize(relativePath);
  if (
    normalized === ".." ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    throw new PathGuardError("path must stay inside the output directory.");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new PathGuardError("path must stay inside the output directory.");
  }
  const prefix = segments[0];
  if (!prefix || !allowed.includes(prefix)) {
    throw new PathGuardError(`path ${normalized} is outside the allowed paths.`);
  }
  const rootResolved = path.resolve(root);
  const full = path.resolve(rootResolved, ...segments);
  const relative = path.relative(rootResolved, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathGuardError("path must stay inside the output directory.");
  }
  return full;
}

export function writeSandboxed(
  root: string,
  relativePath: string,
  allowed: readonly string[],
  contents: string,
): string {
  const full = resolveSandboxed(root, relativePath, allowed);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
  return full;
}

export function readSandboxed(root: string, relativePath: string, allowed: readonly string[]): string {
  const full = resolveSandboxed(root, relativePath, allowed);
  return readFileSync(full, "utf8");
}

export function listSandboxed(root: string): string[] {
  const rootResolved = path.resolve(root);
  if (!existsDir(rootResolved)) return [];
  const found: string[] = [];
  walk(rootResolved, rootResolved, found);
  found.sort();
  return found;
}

function existsDir(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir: string, root: string, found: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, root, found);
    else if (stat.isFile()) found.push(path.relative(root, full).split(path.sep).join("/"));
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/runtime/path-guard.ts";
