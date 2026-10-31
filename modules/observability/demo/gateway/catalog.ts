/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createRequire } from "node:module";
import type { request as HttpRequest } from "node:http";
import type { request as HttpsRequest } from "node:https";

const nodeRequire = createRequire(import.meta.url);

/**
 * Loaded through `require` so the HTTP instrumentation, which wraps the
 * CommonJS export, can add `traceparent` on the way out.
 */
function httpRequest(): typeof HttpRequest {
  return (nodeRequire("node:http") as typeof import("node:http")).request;
}

function httpsRequest(): typeof HttpsRequest {
  return (nodeRequire("node:https") as typeof import("node:https")).request;
}

export function catalogBaseUrl(): string {
  const raw = process.env.CATALOG_BASE_URL?.trim() || "http://127.0.0.1:3001";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CATALOG_BASE_URL must be an http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CATALOG_BASE_URL must be an http(s) URL.");
  }
  return raw.replace(/\/$/, "");
}

/** Outgoing call. HTTP instrumentation adds `traceparent`; this forwards the request id. */
export function callCatalog(
  urlString: string,
  requestId: string,
): Promise<{ status: number; body: string }> {
  const url = new URL(urlString);
  const transport = url.protocol === "https:" ? httpsRequest() : httpRequest();
  return new Promise((resolve, reject) => {
    const req = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          accept: "application/json",
          "x-request-id": requestId,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.setTimeout(5000, () => {
      req.destroy(new Error("The catalog did not answer in time."));
    });
    req.on("error", reject);
    req.end();
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#demo/gateway/catalog.ts";
