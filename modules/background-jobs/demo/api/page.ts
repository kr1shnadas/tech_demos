/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export function dashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Background jobs</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f3efe6;
      --ink: #1e1a16;
      --muted: #5e564c;
      --line: #ddd4c6;
      --card: #fffdf8;
      --teal: #0e5f5c;
      --deny: #8d2e2e;
      --allow: #1d6b3a;
      --warn: #8a5a12;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--paper);
      color: var(--ink);
      font: 16px/1.5 "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    button { font: inherit; }
    button {
      border: 1px solid var(--teal);
      background: var(--teal);
      color: #f6f3ec;
      padding: 10px 14px;
    }
    button.danger { background: var(--deny); border-color: var(--deny); }
    button.warn { background: var(--warn); border-color: var(--warn); }
    button.quiet { background: transparent; color: var(--teal); }
    button:disabled { opacity: 0.55; }
    .page { max-width: 1080px; margin: 0 auto; padding: 28px 20px 56px; }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
    }
    .eyebrow { margin: 0; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; color: var(--muted); }
    h1 { font-family: Georgia, Palatino, serif; font-size: 34px; font-weight: 500; margin: 0; }
    h2 { font-family: Georgia, Palatino, serif; font-size: 22px; font-weight: 500; margin: 28px 0 12px; }
    .shell-label {
      border: 1px solid var(--line);
      background: var(--card);
      padding: 6px 10px;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .note { color: var(--muted); margin: 16px 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 4px; }
    .queues { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    .card { background: var(--card); border: 1px solid var(--line); padding: 14px 16px 16px; }
    .card h3 { margin: 0 0 10px; font-size: 18px; font-weight: 600; text-transform: capitalize; }
    .counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .count { border: 1px solid var(--line); padding: 8px; }
    .count strong { display: block; font-size: 26px; font-variant-numeric: tabular-nums; }
    .count span { color: var(--muted); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
    .count.bad strong { color: var(--deny); }
    .count.wait strong { color: var(--warn); }
    table { width: 100%; border-collapse: collapse; background: var(--card); }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 14px; }
    th { color: var(--muted); font-weight: 600; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
    .activity { list-style: none; padding: 0; margin: 0; background: var(--card); border: 1px solid var(--line); }
    .activity li { padding: 8px 12px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
    .activity time { color: var(--muted); margin-right: 8px; }
    .empty { color: var(--muted); padding: 12px; background: var(--card); border: 1px solid var(--line); }
    footer { margin-top: 28px; color: var(--muted); font-size: 13px; }
    footer p { margin: 0; }
  </style>
</head>
<body>
  <main class="page">
    <header class="top">
      <div>
        <p class="eyebrow">Warehouse desk</p>
        <h1>Background jobs</h1>
      </div>
      <div class="shell-label" id="redis">Redis …</div>
    </header>
    <p class="note">Import a batch and send a notice. The flaky sync fails, waits, then succeeds. The failing sync uses up its attempts and sits in the dead letter until you retry it.</p>
    <div class="actions">
      <button type="button" data-post="/api/demo/import">Import a batch</button>
      <button type="button" data-post="/api/demo/notice">Send a notice</button>
      <button type="button" class="warn" data-post="/api/demo/sync" data-body='{"outcome":"transient"}'>Sync with retries</button>
      <button type="button" class="danger" data-post="/api/demo/sync" data-body='{"outcome":"outage"}'>Sync that fails</button>
      <button type="button" class="quiet" data-post="/api/demo/import" data-body='{"delayMs":5000}'>Import in 5 seconds</button>
      <button type="button" class="quiet" data-post="/api/demo/digest">Digest every minute</button>
    </div>
    <p class="note" id="status"></p>
    <section id="queues" class="queues"></section>
    <h2>Dead letter</h2>
    <div id="dead"></div>
    <h2>Failed</h2>
    <div id="failed"></div>
    <h2>Activity</h2>
    <div id="activity"></div>
    <footer>
      <p>Krishna Das · Copyright 2026 · Apache-2.0</p>
      <p>See NOTICE at the repository root.</p>
    </footer>
  </main>
  <script>
    const statusLine = document.querySelector("#status");
    const redisLabel = document.querySelector("#redis");

    document.querySelectorAll("[data-post]").forEach((button) => {
      button.addEventListener("click", () => send(button.dataset.post, button.dataset.body));
    });

    async function send(url, raw) {
      statusLine.textContent = "Sending…";
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw || "{}",
      });
      const payload = await response.json().catch(() => ({}));
      statusLine.textContent = response.ok
        ? "Queued " + (payload.name || "job") + (payload.id ? " " + payload.id : "")
        : (payload.message || "Request failed");
      await refresh();
    }

    async function retry(body) {
      await send("/api/demo/retry", JSON.stringify(body));
    }

    async function refresh() {
      const response = await fetch("/api/board");
      if (!response.ok) {
        redisLabel.textContent = "Board unavailable";
        return;
      }
      render(await response.json());
    }

    function render(board) {
      redisLabel.textContent = board.redis === "up" ? "Redis up" : "Redis down";
      const queues = document.querySelector("#queues");
      queues.replaceChildren(...board.queues.map(queueCard));
      document.querySelector("#dead").replaceChildren(table(board.deadLetter, deadRow, "No dead letters."));
      document.querySelector("#failed").replaceChildren(table(board.failed, failedRow, "No failed jobs."));
      const list = document.createElement("ol");
      list.className = "activity";
      const rows = board.activity.slice(0, 12);
      if (rows.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "Jobs you enqueue show up here.";
        document.querySelector("#activity").replaceChildren(empty);
        return;
      }
      for (const entry of rows) {
        const item = document.createElement("li");
        const time = document.createElement("time");
        time.dateTime = entry.at;
        time.textContent = clock(entry.at);
        item.append(time, document.createTextNode(entry.message));
        list.append(item);
      }
      document.querySelector("#activity").replaceChildren(list);
    }

    function queueCard(queue) {
      const card = document.createElement("article");
      card.className = "card";
      const title = document.createElement("h3");
      title.textContent = queue.name;
      const counts = document.createElement("div");
      counts.className = "counts";
      counts.append(
        count("waiting", queue.waiting, "wait"),
        count("active", queue.active, ""),
        count("delayed", queue.delayed, "wait"),
        count("completed", queue.completed, ""),
        count("failed", queue.failed, queue.failed ? "bad" : ""),
        count("dead letter", queue.deadLetter, queue.deadLetter ? "bad" : ""),
      );
      card.append(title, counts);
      return card;
    }

    function count(label, value, tone) {
      const wrap = document.createElement("div");
      wrap.className = "count" + (tone ? " " + tone : "");
      const num = document.createElement("strong");
      num.textContent = String(value);
      const name = document.createElement("span");
      name.textContent = label;
      wrap.append(num, name);
      return wrap;
    }

    function table(rows, draw, emptyText) {
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = emptyText;
        return empty;
      }
      const tableEl = document.createElement("table");
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const label of ["Queue", "Job", "Subject", "Attempts", "Reason", ""]) {
        const cell = document.createElement("th");
        cell.textContent = label;
        headRow.append(cell);
      }
      head.append(headRow);
      const body = document.createElement("tbody");
      for (const row of rows) body.append(draw(row));
      tableEl.append(head, body);
      return tableEl;
    }

    function deadRow(row) {
      return dataRow(row.sourceQueue, row.jobName, row.subject, row.attemptsMade, row.failedReason, () => {
        retry({ deadLetterId: row.id });
      });
    }

    function failedRow(row) {
      return dataRow(row.queue, row.name, row.subject, row.attemptsMade, row.reason, () => {
        retry({ queue: row.queue, jobId: row.jobId });
      });
    }

    function dataRow(queue, name, subject, attempts, reason, onRetry) {
      const tr = document.createElement("tr");
      for (const value of [queue, name, subject, String(attempts), reason]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.append(cell);
      }
      const action = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiet";
      button.textContent = "Retry";
      button.addEventListener("click", onRetry);
      action.append(button);
      tr.append(action);
      return tr;
    }

    function clock(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleTimeString([], { hour12: false });
    }

    refresh();
    setInterval(refresh, 500);
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

export const buildFingerprint = "background-jobs@0.1.0#demo/api/page.ts";
