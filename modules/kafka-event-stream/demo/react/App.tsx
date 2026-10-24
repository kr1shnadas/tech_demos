/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { useEffect, useState } from "react";
import { authorCredit as credit, buildFingerprint as fingerprint } from "../../src/credit.js";
import type { ReplayResult, StreamStatus } from "../../src/nest/consumer.service.js";

export function App() {
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [partitionKey, setPartitionKey] = useState("batch-14");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replayNote, setReplayNote] = useState("");

  useEffect(() => {
    let stopped = false;
    const pull = async () => {
      try {
        const response = await fetch("/api/status");
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = (await response.json()) as StreamStatus;
        if (!stopped) {
          setStatus(body);
          setError("");
        }
      } catch {
        if (!stopped) setError("The API is not responding.");
      }
    };
    void pull();
    const timer = setInterval(() => void pull(), 500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  async function send(kind: "good" | "poison") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, partitionKey }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `request failed (${response.status})`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The event was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function replay() {
    setBusy(true);
    setReplayNote("");
    try {
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset: "0", limit: 50 }),
      });
      if (!response.ok) throw new Error(`replay ${response.status}`);
      const body = (await response.json()) as ReplayResult;
      setReplayNote(
        `Read ${body.read}. Applied ${body.applied}. Duplicates ${body.duplicates}. Dead-lettered ${body.dead}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Replay failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Kafka event streaming</p>
          <h1 className="brand">Ingestion stream</h1>
        </div>
        <div className="shell-label">React</div>
      </header>

      <div className="actions">
        <label>
          Partition key
          <input value={partitionKey} onChange={(event) => setPartitionKey(event.target.value)} />
        </label>
        <button type="button" disabled={busy} onClick={() => void send("good")}>
          Send a good event
        </button>
        <button type="button" className="danger" disabled={busy} onClick={() => void send("poison")}>
          Send a poison event
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void replay()}>
          Replay from offset 0
        </button>
      </div>
      <p className="note">
        A good event is applied once. A poison event fails, waits on the retry topics, then lands in the
        dead-letter queue. Events that share a partition key stay in order.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {replayNote ? <p className="replay">{replayNote}</p> : null}

      <div className="board">
        <section className="card">
          <h2>Events</h2>
          {status && status.events.length > 0 ? (
            status.events.map((event) => (
              <div className="row" key={event.eventId}>
                <div>
                  <span className="badge">{event.eventType}</span>
                </div>
                <div>
                  <strong>{event.partitionKey}</strong> · sequence {event.sequence}
                </div>
                <div className="muted">{event.eventId}</div>
              </div>
            ))
          ) : (
            <p className="muted">No events yet.</p>
          )}
        </section>

        <section className="card">
          <h2>Consumer lag</h2>
          <p className="lag-total">
            {status ? status.lag.total : "–"}
            <span>behind</span>
          </p>
          {status && status.lag.partitions.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>End</th>
                  <th>Committed</th>
                  <th>Lag</th>
                </tr>
              </thead>
              <tbody>
                {status.lag.partitions.map((part) => (
                  <tr key={part.partition}>
                    <td>{part.partition}</td>
                    <td>{part.endOffset}</td>
                    <td>{part.committed}</td>
                    <td>{part.lag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Waiting for the consumer group.</p>
          )}
          {status && status.retries.length > 0 ? (
            <>
              <h2>Retries</h2>
              {status.retries.map((route) => (
                <div className="row" key={`${route.eventId}-${route.attempt}`}>
                  attempt {route.attempt} → {route.destination}
                </div>
              ))}
            </>
          ) : null}
        </section>

        <section className="card dead-card">
          <h2>Dead letter</h2>
          {status && status.deadLetters.length > 0 ? (
            status.deadLetters.map((letter) => (
              <div className="row" key={letter.eventId}>
                <div>
                  <span className="badge dead">{letter.reason}</span>
                </div>
                <div>
                  <strong>{letter.partitionKey}</strong> · {letter.attempts} attempts
                </div>
                <div className="muted">{letter.eventId}</div>
              </div>
            ))
          ) : (
            <p className="muted">The dead-letter queue is empty.</p>
          )}
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

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#demo/react/App.tsx";
