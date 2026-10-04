/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../shared/demo.css";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/react/main.tsx";
