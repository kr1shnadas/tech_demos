/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import type { AuthUser } from "../../src/access/evaluate-access.js";
import { beginSignIn, completeSignIn } from "../../src/browser/sign-in.js";
import { readAccessToken } from "../../src/browser/session.js";
import { authorCredit as credit, buildFingerprint as fingerprint } from "../../src/credit.js";
import { RequireRole } from "../../src/react/require-role.js";
import { callApi, messageOf, type ApiResult } from "../shared/api.js";
import { DemoProvider, useDemo } from "./demo-context.js";

export function App() {
  return (
    <DemoProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="callback" element={<CallbackPage />} />
          <Route path="study" element={<StudyRoute />} />
          <Route path="audit" element={<AuditRoute />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </DemoProvider>
  );
}

function Shell() {
  const demo = useDemo();
  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Authentication and role-based access</p>
          <h1 className="brand">Study access</h1>
        </div>
        <div className="shell-label">React</div>
      </header>
      <div className="layout">
        <aside className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Home
          </NavLink>
          <NavLink to="/study" className={({ isActive }) => (isActive ? "active" : "")}>
            Study workspace
          </NavLink>
          <NavLink to="/audit" className={({ isActive }) => (isActive ? "active" : "")}>
            Audit review
          </NavLink>
          {demo.user ? (
            <button className="ghost" type="button" onClick={demo.signOut}>
              Sign out
            </button>
          ) : null}
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
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

function HomePage() {
  const demo = useDemo();
  const redirectUri = `${window.location.origin}/callback`;

  if (!demo.ready) return <p className="muted">Loading configuration…</p>;

  if (!demo.user) {
    return (
      <section className="card">
        <h2>Sign in</h2>
        <p className="muted">
          The local identity provider issues an access token. This React route guard and the API
          both check it.
        </p>
        {demo.configError ? <p className="denied card">{demo.configError}</p> : null}
        <p className="muted">Provider: {demo.config.provider}</p>
        <button type="button" onClick={() => void beginSignIn(demo.config, redirectUri)}>
          Continue to sign in
        </button>
      </section>
    );
  }

  return (
    <section className="card allowed">
      <h2>Signed in as {demo.user.name}</h2>
      <p className="muted">{demo.user.email}</p>
      <div className="roles">
        {demo.user.roles.map((role) => (
          <span className="role" key={role}>
            {role}
          </span>
        ))}
      </div>
      <p className="muted">Provider {demo.config.provider}. Open a route to see the guard decide.</p>
      <div className="choices">
        <Link className="card choice" to="/study">
          <strong>Study workspace</strong>
          <span className="muted">Allowed for clinician and admin.</span>
        </Link>
        <Link className="card choice" to="/audit">
          <strong>Audit review</strong>
          <span className="muted">Allowed for auditor and admin.</span>
        </Link>
      </div>
    </section>
  );
}

function CallbackPage() {
  const demo = useDemo();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!demo.ready || started.current) return;
    started.current = true;
    const redirectUri = `${window.location.origin}/callback`;
    completeSignIn(demo.config, redirectUri, new URLSearchParams(window.location.search))
      .then(() => demo.refresh())
      .then(() => navigate("/", { replace: true }))
      .catch((reason: unknown) => {
        if (readAccessToken()) {
          navigate("/", { replace: true });
          return;
        }
        setError(reason instanceof Error ? reason.message : "Sign-in failed.");
      });
  }, [demo.ready, demo, navigate]);

  if (error) {
    return (
      <section className="card denied">
        <h2>Sign-in failed</h2>
        <p>{error}</p>
        <Link to="/">Back home</Link>
      </section>
    );
  }
  return <p className="muted">Completing sign-in…</p>;
}

function StudyRoute() {
  const demo = useDemo();
  if (!demo.ready) return <p className="muted">Checking access…</p>;
  return (
    <RequireRole
      roles={["clinician", "admin"]}
      config={demo.config}
      denied={(user) => <DeniedPanel user={user} roles={["clinician", "admin"]} apiPath="/api/study" />}
    >
      <ResourcePanel title="Study workspace" apiPath="/api/study" tone="allowed" />
    </RequireRole>
  );
}

function AuditRoute() {
  const demo = useDemo();
  if (!demo.ready) return <p className="muted">Checking access…</p>;
  return (
    <RequireRole
      roles={["auditor", "admin"]}
      config={demo.config}
      denied={(user) => <DeniedPanel user={user} roles={["auditor", "admin"]} apiPath="/api/audit" />}
    >
      <ResourcePanel title="Audit review" apiPath="/api/audit" tone="allowed" />
    </RequireRole>
  );
}

function ResourcePanel({ title, apiPath, tone }: { title: string; apiPath: string; tone: string }) {
  const result = useProtected(apiPath);
  return (
    <section className={`card ${tone}`}>
      <h2>{title}</h2>
      <p className="muted">API {apiPath} answered {result ? result.status : "…"}.</p>
      {result ? <ResourceBody body={result.body} /> : null}
    </section>
  );
}

function DeniedPanel({
  user,
  roles,
  apiPath,
}: {
  user: AuthUser;
  roles: readonly string[];
  apiPath: string;
}) {
  const result = useProtected(apiPath);
  return (
    <section className="card denied">
      <h2>Access denied</h2>
      <p>
        {user.name} holds {user.roles.join(", ")}. This route needs one of {roles.join(", ")}.
      </p>
      <p className="muted">
        The API still made the decision: {apiPath} answered {result ? result.status : "…"}.
        {result ? ` ${messageOf(result.body)}` : ""}
      </p>
    </section>
  );
}

function ResourceBody({ body }: { body: unknown }) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const subjects = Array.isArray(record.subjects) ? record.subjects : null;
  const entries = Array.isArray(record.entries) ? record.entries : null;
  return (
    <>
      {typeof record.protocol === "string" ? (
        <p>
          {record.protocol} — {String(record.title)} · {String(record.status)}
        </p>
      ) : null}
      {typeof record.title === "string" && !record.protocol ? <p>{record.title}</p> : null}
      {subjects ? (
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Site</th>
              <th>Visit</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((item) => {
              const row = item as Record<string, string>;
              return (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.site}</td>
                  <td>{row.visit}</td>
                  <td>{row.state}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {entries ? (
        <table>
          <thead>
            <tr>
              <th>Visit</th>
              <th>Site</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((item) => {
              const row = item as Record<string, string>;
              return (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.site}</td>
                  <td>{row.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

function useProtected(apiPath: string): ApiResult | null {
  const [result, setResult] = useState<ApiResult | null>(null);
  useEffect(() => {
    const token = readAccessToken();
    if (!token) return;
    void callApi(apiPath, token).then(setResult);
  }, [apiPath]);
  return result;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/react/App.tsx";
