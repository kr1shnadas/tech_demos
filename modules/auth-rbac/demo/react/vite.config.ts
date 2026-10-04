/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/react/vite.config.ts";
