/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { demoUsers, type DemoUser } from "./users.js";

export function renderLoginPage(options: { error?: string }): string {
  const personas = demoUsers
    .map(
      (user) => `
      <form method="post" action="/authorize">
        <input type="hidden" name="username" value="${escapeHtml(user.username)}" />
        <input type="hidden" name="password" value="${escapeHtml(user.password)}" />
        <button class="persona" type="submit">
          <span class="persona-name">${escapeHtml(user.name)}</span>
          <span class="persona-meta">${escapeHtml(user.roles.join(", "))} · ${escapeHtml(user.summary)}</span>
          <span class="persona-meta">Password ${escapeHtml(user.password)}</span>
        </button>
      </form>`,
    )
    .join("");

  const error = options.error
    ? `<p class="banner" role="alert">${escapeHtml(options.error)}</p>`
    : "";

  return layout(
    "Sign in",
    `
    <p class="eyebrow">Local demo identity provider</p>
    <h1>Choose a study account</h1>
    <p class="lede">These accounts exist only in this process. The password matches the username.</p>
    ${error}
    <div class="personas">${personas}</div>
    <form class="manual" method="post" action="/authorize">
      <label>Username <input name="username" autocomplete="username" /></label>
      <label>Password <input name="password" type="password" autocomplete="current-password" /></label>
      <button class="button" type="submit">Sign in</button>
    </form>
    `,
  );
}

export function renderMessagePage(title: string, message: string): string {
  return layout(title, `<h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(message)}</p>`);
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Study access</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #f3efe6;
      color: #1e1a16;
      font: 16px/1.5 "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    main { max-width: 640px; margin: 0 auto; padding: 48px 20px 32px; }
    .eyebrow { letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; color: #5e564c; margin: 0; }
    h1 { font-family: Georgia, Palatino, serif; font-weight: 500; font-size: 36px; margin: 8px 0 12px; }
    .lede { color: #5e564c; margin-top: 0; }
    .banner { background: #f8ebe3; border: 1px solid #e2c2b6; color: #8d2e2e; padding: 10px 12px; }
    .personas { display: grid; gap: 10px; }
    .persona, .button {
      width: 100%;
      text-align: left;
      background: #fffdf8;
      border: 1px solid #ddd4c6;
      padding: 14px 16px;
      font: inherit;
      color: inherit;
    }
    .persona:hover, .button:hover { border-color: #0e5f5c; }
    .persona-name { display: block; font-family: Georgia, Palatino, serif; font-size: 20px; }
    .persona-meta { display: block; color: #5e564c; font-size: 14px; }
    .manual { display: grid; gap: 10px; margin-top: 28px; }
    label { display: grid; gap: 4px; font-size: 14px; color: #5e564c; }
    input { font: inherit; padding: 8px 10px; border: 1px solid #ddd4c6; background: #fffdf8; color: inherit; }
    .button { text-align: center; background: #0e5f5c; color: #f3efe6; }
    footer { margin-top: 36px; color: #5e564c; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    ${body}
    <footer>
      <p>Krishna Das · Copyright 2026 · Apache-2.0</p>
      <p>See NOTICE at the repository root.</p>
    </footer>
  </main>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function personaByName(name: string): DemoUser | undefined {
  return demoUsers.find((user) => user.username === name);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/demo-idp/page.ts";
