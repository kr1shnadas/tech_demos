/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { demoConfig } from "./pace.js";

const config = demoConfig();
const port = readPort(process.env.PORT ?? "3000");

const app = await NestFactory.create(AppModule.register(config), { logger: false });
app.enableShutdownHooks();
await app.listen(port, "0.0.0.0");
console.log(`listening on ${port}`);

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
};
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});

function readPort(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  return value;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#demo/api/main.ts";
