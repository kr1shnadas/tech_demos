/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export const demoApiBase = "http://localhost:4000";

export interface ApiResult {
  status: number;
  body: unknown;
}

export async function callApi(path: string, token?: string, apiBase = demoApiBase): Promise<ApiResult> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  } catch {
    return { status: 0, body: { message: "The API is not reachable." } };
  }
}

export function messageOf(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.map(String).join(" ");
  }
  return "";
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/shared/api.ts";
