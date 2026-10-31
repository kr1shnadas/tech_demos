/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { useState } from "react";
import { authorCredit as credit, buildFingerprint as fingerprint } from "../../src/credit.js";

type Mode = "ok" | "slow" | "fail";

interface CallRow {
  id: number;
  mode: Mode;
  status: number;
  durationMs: number;
  requestId: string;
  traceId: string;
  detail: string;
}

interface CheckBody {
  mode?: string;
  status?: number;
  requestId?: string;
  traceId?: string;
  durationMs?: number;
  message?: string;
  catalog?: { result?: string; waitedMs?: number; service?: string };
}

export function App() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let nextId = rows.length + 1;

  async function run(mode: Mode) {
    setBusy(true);
    setError("");
    const started = performance.now();
    try {
      const response = await fetch(`/api/checks?mode=${mode}`);
      const headerId = response.headers.get("x-request-id") ?? "";
      let body: CheckBody = {};
      try {
        body = (await response.json()) as CheckBody;
      } catch {
        body = {};
      }
      const durationMs = Math.round(performance.now() - started);
      const requestId = body.requestId || headerId;
      const traceId = body.traceId || "";
      const detail = describe(mode, response.status, body);
      setRows((current) => [
        { id: nextId, mode, status: response.status, durationMs, requestId, traceId, detail },
        ...current,
      ].slice(0, 12));
    } catch {
      setError("The gateway is not responding.");
    } finally {
      setBusy(false);
    }
  }

  const latest = rows[0];

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Observability</p>
          <h1 className="brand">Study checks</h1>
        </div>
        <div className="shell-label">React</div>
      </header>

      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void run("ok")}>
          Normal
        </button>
        <button type="button" className="slow" disabled={busy} onClick={() => void run("slow")}>
          Slow
        </button>
        <button type="button" className="danger" disabled={busy} onClick={() => void run("fail")}>
          Failing
        </button>
      </div>
      <p className="note">
        The gateway calls the catalog. Normal returns at once. Slow waits in the catalog. Failing
        makes the catalog answer with an error. Both services log the same request id, and the trace
        continues across the call.
      </p>
      <p className="links">
        <a href="http://localhost:3002/d/study-observability/study-checks">Grafana</a>
        <a href="http://localhost:16686/search?service=study-gateway">Jaeger</a>
        <a href="http://localhost:9090/rules">Prometheus rules</a>
      </p>
      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <h2>Calls</h2>
        {rows.length === 0 ? (
          <p className="muted">No calls yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Mode</th>
                <th>Status</th>
                <th>Time</th>
                <th>Request</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={badgeClass(row.mode)}>{label(row.mode)}</span>
                  </td>
                  <td>{row.status}</td>
                  <td>{row.durationMs} ms</td>
                  <td className="mono">{row.requestId || "—"}</td>
                  <td className="mono">
                    {row.traceId ? (
                      <a href={`http://localhost:16686/trace/${row.traceId}`}>{row.traceId.slice(0, 12)}</a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {latest ? <p className="note">{latest.detail}</p> : null}
      </section>

      <footer>
        <p>
          {credit.name} · {credit.copyright} · {credit.license}
        </p>
        <p>{credit.notice}</p>
        <p className="fingerprint">{fingerprint}</p>
      </footer>
    </div>
  );
}

function label(mode: Mode): string {
  if (mode === "ok") return "normal";
  if (mode === "slow") return "slow";
  return "failing";
}

function badgeClass(mode: Mode): string {
  if (mode === "fail") return "badge fail";
  if (mode === "slow") return "badge slow";
  return "badge";
}

function describe(mode: Mode, status: number, body: CheckBody): string {
  if (mode === "fail" || status >= 400) {
    return body.message || `The call finished with status ${status}.`;
  }
  const waited = body.catalog?.waitedMs;
  if (mode === "slow") return `The catalog waited ${waited ?? "—"} ms and answered.`;
  return "The catalog answered at once.";
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#demo/react/App.tsx";
