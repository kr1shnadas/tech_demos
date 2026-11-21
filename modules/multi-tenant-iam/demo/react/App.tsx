/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { useEffect, useState } from "react";
import { authorCredit as credit, buildFingerprint as fingerprint } from "../../src/credit.js";

interface Membership {
  tenantId: string;
  tenantName: string;
  role: string;
}

interface Person {
  sub: string;
  name: string;
  email: string;
  memberships: Membership[];
}

interface DeskConfig {
  resolution: { source: "jwt" | "header" | "subdomain"; headerName: string; baseDomain: string };
  isolation: { mode: "rls" | "schema" };
}

interface SessionView {
  user: { sub: string; name: string; email?: string };
  tenant: { id: string; name: string };
  role: string;
  permissions: string[];
}

interface RecordNote {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  tenantId: string;
  occurredAt: string;
  actorSub: string;
  action: string;
  resource: string;
  detail: { title?: string };
}

interface Member {
  userSub: string;
  roleName: string;
}

export function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [config, setConfig] = useState<DeskConfig | null>(null);
  const [personSub, setPersonSub] = useState("meera");
  const [tenantId, setTenantId] = useState("northwind");
  const [token, setToken] = useState("");
  const [me, setMe] = useState<SessionView | null>(null);
  const [records, setRecords] = useState<RecordNote[]>([]);
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [membersNote, setMembersNote] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const person = people.find((item) => item.sub === personSub) ?? null;

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const [directoryRes, configRes] = await Promise.all([fetch("/api/directory"), fetch("/api/config")]);
        if (!directoryRes.ok || !configRes.ok) throw new Error("The API is not responding.");
        const directory = (await directoryRes.json()) as { people: Person[] };
        const nextConfig = (await configRes.json()) as DeskConfig;
        if (stopped) return;
        setPeople(directory.people);
        setConfig(nextConfig);
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "The API is not responding.");
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!person || !config) return;
    const membership = person.memberships.some((item) => item.tenantId === tenantId)
      ? tenantId
      : person.memberships[0]?.tenantId;
    if (!membership) return;
    if (membership !== tenantId) {
      setTenantId(membership);
      return;
    }

    let stopped = false;
    setBusy(true);
    setError("");
    setMe(null);
    setRecords([]);
    setEvents([]);
    setMembers(null);
    setMembersNote("");
    void (async () => {
      try {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sub: person.sub, tenantId: membership }),
        });
        const session = (await sessionRes.json()) as SessionView & { token?: string; message?: string };
        if (!sessionRes.ok || !session.token) {
          throw new Error(messageOf(session.message) || "The session was refused.");
        }
        const headers = authHeaders(config, session.token, membership);
        const [meRes, recordsRes, auditRes, membersRes] = await Promise.all([
          fetch("/api/me", { headers }),
          fetch("/api/records", { headers }),
          fetch("/api/audit", { headers }),
          fetch("/api/members", { headers }),
        ]);
        if (!meRes.ok || !recordsRes.ok || !auditRes.ok) {
          throw new Error("The tenant scope did not load.");
        }
        const nextMe = (await meRes.json()) as SessionView;
        const recordBody = (await recordsRes.json()) as { records: RecordNote[] };
        const auditBody = (await auditRes.json()) as { events: AuditRow[] };
        let nextMembers: Member[] | null = null;
        let nextMembersNote = "";
        if (membersRes.status === 403) {
          const denied = (await membersRes.json()) as { message?: string };
          nextMembersNote = messageOf(denied.message) || "This role cannot list members.";
        } else if (membersRes.ok) {
          const memberBody = (await membersRes.json()) as { members: Member[] };
          nextMembers = memberBody.members;
        } else {
          throw new Error("The member list did not load.");
        }
        if (stopped) return;
        setToken(session.token);
        setMe(nextMe);
        setRecords(recordBody.records);
        setEvents(auditBody.events);
        setMembers(nextMembers);
        setMembersNote(nextMembersNote);
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "The tenant scope did not load.");
      } finally {
        if (!stopped) setBusy(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [person, config, tenantId]);

  async function addRecord() {
    if (!config || !token || !me) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeaders(config, token, me.tenant.id),
        },
        body: JSON.stringify({ title, body }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(messageOf(payload.message) || "The record was not saved.");
      setTitle("");
      setBody("");
      const headers = authHeaders(config, token, me.tenant.id);
      const [recordsRes, auditRes] = await Promise.all([
        fetch("/api/records", { headers }),
        fetch("/api/audit", { headers }),
      ]);
      if (!recordsRes.ok || !auditRes.ok) throw new Error("The lists did not refresh.");
      const recordBody = (await recordsRes.json()) as { records: RecordNote[] };
      const auditBody = (await auditRes.json()) as { events: AuditRow[] };
      setRecords(recordBody.records);
      setEvents(auditBody.events);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record was not saved.");
    } finally {
      setBusy(false);
    }
  }

  const canWrite = me?.permissions.includes("records.write") ?? false;
  const names = new Map(people.map((item) => [item.sub, item.name]));
  const accent = tenantId === "harbor" ? "#8a4b2a" : "#0e5f5c";

  return (
    <div className="page" style={{ ["--accent" as string]: accent }} data-tenant={tenantId}>
      <header className="top">
        <div>
          <p className="eyebrow">Multi-tenant IAM</p>
          <h1 className="brand">Tenant desk</h1>
        </div>
        <div className="shell-label">React</div>
      </header>

      <div className="switchers">
        <div>
          <p>Person</p>
          <div className="pills">
            {people.map((item) => (
              <button
                key={item.sub}
                type="button"
                className={item.sub === personSub ? "active" : ""}
                onClick={() => setPersonSub(item.sub)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p>Tenant</p>
          <div className="pills">
            {(person?.memberships ?? []).map((item) => (
              <button
                key={item.tenantId}
                type="button"
                className={item.tenantId === tenantId ? "active" : ""}
                onClick={() => setTenantId(item.tenantId)}
              >
                {item.tenantName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {me ? (
        <div className="scope">
          <span>
            <strong>{me.tenant.name}</strong>
          </span>
          <span>
            Role <strong>{me.role}</strong>
          </span>
          <span>{config ? isolationLabel(config.isolation.mode) : ""}</span>
          <span>{config ? sourceLabel(config.resolution.source) : ""}</span>
        </div>
      ) : null}

      <p className="note">
        The record and audit queries do not filter by tenant. Postgres returns only the rows for the
        tenant on this session.
      </p>
      {error ? <p className="error">{error}</p> : null}

      <div className="board">
        <section className="card">
          <h2>
            Records <span>{me ? records.length : ""}</span>
          </h2>
          {canWrite ? (
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void addRecord();
              }}
            >
              <input
                value={title}
                placeholder="Note title"
                onChange={(event) => setTitle(event.target.value)}
              />
              <textarea
                value={body}
                placeholder="What happened"
                onChange={(event) => setBody(event.target.value)}
              />
              <div>
                <button className="primary" type="submit" disabled={busy || !title.trim() || !body.trim()}>
                  Add a record
                </button>
              </div>
            </form>
          ) : (
            <p className="closed">A reader can open records and the audit trail. Adding a record stays closed.</p>
          )}
          {records.length === 0 ? <p className="muted">{busy ? "Loading." : "No records in this tenant."}</p> : null}
          {records.map((record) => (
            <div className="row" key={record.id}>
              <strong>{record.title}</strong>
              <p>{record.body}</p>
              <div className="meta">
                {names.get(record.createdBy) ?? record.createdBy} · {formatWhen(record.createdAt)}
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>
            Audit trail <span>{me ? events.length : ""}</span>
          </h2>
          {events.length === 0 ? <p className="muted">{busy ? "Loading." : "No audit events."}</p> : null}
          {events.map((event) => (
            <div className="row" key={event.id}>
              <div>
                <span className="badge">{event.action}</span>
              </div>
              <strong>{event.detail.title ?? event.resource}</strong>
              <div className="meta">
                {names.get(event.actorSub) ?? event.actorSub} · {formatWhen(event.occurredAt)}
              </div>
            </div>
          ))}
          <div className="members">
            <h2>Members</h2>
            {membersNote ? <p className="closed">{membersNote}</p> : null}
            {members ? (
              <ul>
                {members.map((member) => (
                  <li key={member.userSub}>
                    {names.get(member.userSub) ?? member.userSub} · {member.roleName}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
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

function authHeaders(config: DeskConfig, token: string, tenantId: string): Record<string, string> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (config.resolution.source === "header") headers[config.resolution.headerName] = tenantId;
  return headers;
}

function isolationLabel(mode: DeskConfig["isolation"]["mode"]): string {
  return mode === "schema" ? "Schema per tenant" : "Row-level security";
}

function sourceLabel(source: DeskConfig["resolution"]["source"]): string {
  if (source === "header") return "Tenant from the header";
  if (source === "subdomain") return "Tenant from the host";
  return "Tenant from the token";
}

function messageOf(message: string | undefined): string {
  return message ?? "";
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#demo/react/App.tsx";
