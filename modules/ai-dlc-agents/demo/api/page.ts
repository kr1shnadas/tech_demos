/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export function deskPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dev lifecycle</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f3efe6;
      --ink: #1e1a16;
      --muted: #5e564c;
      --line: #ddd4c6;
      --card: #fffdf8;
      --teal: #0e5f5c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--paper);
      color: var(--ink);
      font: 16px/1.5 "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    main { max-width: 820px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 28px; font-weight: 650; margin: 0 0 8px; }
    p { margin: 0 0 16px; }
    .muted { color: var(--muted); }
    form, section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
    }
    label { display: block; font-size: 14px; margin-bottom: 12px; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea {
      width: 100%;
      margin-top: 4px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
    }
    textarea { min-height: 88px; resize: vertical; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    button {
      border: 1px solid var(--teal);
      background: var(--teal);
      color: #f6f3ec;
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
    }
    button.secondary { background: transparent; color: var(--teal); }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #f7f4ee;
      border-radius: 8px;
      padding: 12px;
      margin: 0;
    }
    footer { margin-top: 24px; color: var(--muted); font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>Dev lifecycle</h1>
    <p class="muted">Start a workflow, then approve or reject the gate before the next phase runs.</p>
    <form id="start">
      <label>Workflow
        <input name="workflow" value="nestjs-crud">
      </label>
      <label>Profile
        <select name="profile">
          <option value="startup" selected>startup</option>
          <option value="regulated">regulated</option>
        </select>
      </label>
      <label>Who is starting it
        <input name="actor" value="ada">
      </label>
      <label>Intent
        <textarea name="intent">Build a NestJS CRUD service for library books</textarea>
      </label>
      <button type="submit">Start</button>
    </form>
    <section>
      <div class="row">
        <button type="button" id="approve" class="secondary">Approve</button>
        <button type="button" id="reject" class="secondary">Reject</button>
      </div>
      <p class="muted" id="status">No run yet.</p>
      <pre id="out">The run will show here.</pre>
    </section>
    <footer>Krishna Das — Apache-2.0. See NOTICE at the repository root.</footer>
  </main>
  <script>
    const status = document.getElementById("status");
    const out = document.getElementById("out");
    let current = null;
    let actorName = "ada";

    function show(run) {
      current = run;
      status.textContent = run.id + " is " + run.status;
      out.textContent = JSON.stringify(run, null, 2);
    }

    document.getElementById("start").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      actorName = String(form.get("actor") || "ada");
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflow: form.get("workflow"),
          profile: form.get("profile"),
          actor: form.get("actor"),
          intent: form.get("intent"),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        status.textContent = body.message || "Could not start.";
        out.textContent = JSON.stringify(body, null, 2);
        current = null;
        return;
      }
      show(body);
    });

    async function decide(decision) {
      if (!current) return;
      const response = await fetch("/api/runs/" + current.id + "/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: actorName, decision }),
      });
      const body = await response.json();
      if (!response.ok) {
        status.textContent = body.message || "Could not record the decision.";
        return;
      }
      show(body);
    }

    document.getElementById("approve").addEventListener("click", () => decide("approve"));
    document.getElementById("reject").addEventListener("click", () => decide("reject"));
  </script>
</body>
</html>`;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#demo/api/page.ts";
