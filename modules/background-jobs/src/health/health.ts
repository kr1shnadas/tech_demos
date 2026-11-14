/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface ReadinessReport {
  status: "ok" | "unavailable";
  checks: { name: string; ok: boolean }[];
}

/** Liveness means the process can answer. Readiness pings Redis. */
export async function readiness(ping: () => Promise<boolean>): Promise<ReadinessReport> {
  try {
    const ok = await ping();
    return { status: ok ? "ok" : "unavailable", checks: [{ name: "redis", ok }] };
  } catch {
    return { status: "unavailable", checks: [{ name: "redis", ok: false }] };
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

export const buildFingerprint = "background-jobs@0.1.0#src/health/health.ts";
