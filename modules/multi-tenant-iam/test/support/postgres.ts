/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";

export interface PostgresHandle {
  host: string;
  port: number;
  user: string;
  password: string;
  stop: () => Promise<void>;
}

/** Starts a throwaway Postgres for the isolation tests. It does not use the Compose port. */
export async function startPostgres(): Promise<PostgresHandle> {
  const port = await freePort();
  const databaseDir = mkdtempSync(path.join(tmpdir(), "tenant-iam-"));
  const logs: string[] = [];
  const embedded = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: (line) => logs.push(String(line)),
    onError: (line) => logs.push(String(line)),
  });
  try {
    await embedded.initialise();
    await embedded.start();
  } catch (error) {
    const detail = logs.slice(-20).join("\n");
    throw new Error(`Postgres did not start.\n${detail}\n${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "postgres",
    stop: async () => {
      await embedded.stop();
      rmSync(databaseDir, { recursive: true, force: true });
    },
  };
}

export async function createDatabase(handle: PostgresHandle, name: string): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error("Database name is not an identifier.");
  const pool = new Pool({
    host: handle.host,
    port: handle.port,
    user: handle.user,
    password: handle.password,
    database: "postgres",
  });
  try {
    await pool.query(`CREATE DATABASE ${name}`);
  } finally {
    await pool.end();
  }
}

export async function dropDatabase(handle: PostgresHandle, name: string): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error("Database name is not an identifier.");
  const pool = new Pool({
    host: handle.host,
    port: handle.port,
    user: handle.user,
    password: handle.password,
    database: "postgres",
  });
  try {
    await pool.query(`DROP DATABASE IF EXISTS ${name}`);
  } finally {
    await pool.end();
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not reserve a port."));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/support/postgres.ts";
