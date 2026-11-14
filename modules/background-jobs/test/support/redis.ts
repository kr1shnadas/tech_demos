/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { Redis } from "ioredis";

export interface RedisProcess {
  host: string;
  port: number;
  stop: () => Promise<void>;
}

/** Starts a throwaway Redis so the integration tests do not share the demo instance. */
export async function startRedis(): Promise<RedisProcess> {
  const port = await freePort();
  const stderr: Buffer[] = [];
  const proc = spawn(
    "redis-server",
    [
      "--port",
      String(port),
      "--bind",
      "127.0.0.1",
      "--protected-mode",
      "yes",
      "--save",
      "",
      "--appendonly",
      "no",
      "--dir",
      "/tmp",
      "--dbfilename",
      `jobs-${port}.rdb`,
      "--daemonize",
      "no",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr.push(chunk);
  });
  try {
    await waitUntilReady("127.0.0.1", port, proc, stderr);
  } catch (error) {
    proc.kill("SIGKILL");
    throw error;
  }
  return {
    host: "127.0.0.1",
    port,
    stop: () => stopProcess(proc),
  };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not reserve a port."));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitUntilReady(host: string, port: number, proc: ChildProcess, stderr: Buffer[]): Promise<void> {
  const started = Date.now();
  let exitCode: number | null = null;
  proc.once("exit", (code) => {
    exitCode = code;
  });
  while (Date.now() - started < 10_000) {
    if (exitCode !== null) {
      throw new Error(`redis-server exited ${exitCode}: ${Buffer.concat(stderr).toString("utf8")}`);
    }
    const client = new Redis({ host, port, maxRetriesPerRequest: 1, connectTimeout: 200, lazyConnect: true });
    client.on("error", () => undefined);
    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      if (pong === "PONG") return;
    } catch {
      client.disconnect();
      await delay(100);
    }
  }
  throw new Error(`redis-server did not answer: ${Buffer.concat(stderr).toString("utf8")}`);
}

function stopProcess(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 2000);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#test/support/redis.ts";
