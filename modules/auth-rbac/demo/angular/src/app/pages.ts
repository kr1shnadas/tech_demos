/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { beginSignIn, completeSignIn } from "../../../../src/browser/sign-in.js";
import { readAccessToken } from "../../../../src/browser/session.js";
import { callApi, messageOf } from "../../../shared/api.js";
import { SessionStore } from "./session.service.js";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (session.user(); as user) {
      <section class="card allowed">
        <h2>Signed in as {{ user.name }}</h2>
        <p class="muted">{{ user.email }}</p>
        <div class="roles">
          @for (role of user.roles; track role) {
            <span class="role">{{ role }}</span>
          }
        </div>
        <p class="muted">Provider {{ session.config().provider }}. Open a route to see the guard decide.</p>
        <div class="choices">
          <a class="card choice" routerLink="/study">
            <strong>Study workspace</strong>
            <span class="muted">Allowed for clinician and admin.</span>
          </a>
          <a class="card choice" routerLink="/audit">
            <strong>Audit review</strong>
            <span class="muted">Allowed for auditor and admin.</span>
          </a>
        </div>
      </section>
    } @else {
      <section class="card">
        <h2>Sign in</h2>
        <p class="muted">
          The local identity provider issues an access token. This Angular route guard and the API
          both check it.
        </p>
        @if (session.configError()) {
          <p class="denied card">{{ session.configError() }}</p>
        }
        <p class="muted">Provider: {{ session.config().provider }}</p>
        <button type="button" (click)="signIn()">Continue to sign in</button>
      </section>
    }
  `,
})
export class HomePage {
  readonly session = inject(SessionStore);

  signIn(): void {
    void beginSignIn(this.session.config(), `${window.location.origin}/callback`);
  }
}

@Component({
  selector: "app-callback",
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (error()) {
      <section class="card denied">
        <h2>Sign-in failed</h2>
        <p>{{ error() }}</p>
        <a routerLink="/">Back home</a>
      </section>
    } @else {
      <p class="muted">Completing sign-in…</p>
    }
  `,
})
export class CallbackPage {
  readonly error = signal("");
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  constructor() {
    void this.finish();
  }

  private async finish(): Promise<void> {
    try {
      await completeSignIn(
        this.session.config(),
        `${window.location.origin}/callback`,
        new URLSearchParams(window.location.search),
      );
      await this.session.refreshUser();
      await this.router.navigateByUrl("/");
    } catch (reason) {
      if (readAccessToken()) {
        await this.router.navigateByUrl("/");
        return;
      }
      this.error.set(reason instanceof Error ? reason.message : "Sign-in failed.");
    }
  }
}

@Component({
  selector: "app-study",
  standalone: true,
  template: `
    <section class="card allowed">
      <h2>Study workspace</h2>
      <p class="muted">API /api/study answered {{ status() === null ? "…" : status() }}.</p>
      @if (protocol()) {
        <p>{{ protocol() }} — {{ title() }} · {{ studyStatus() }}</p>
      }
      @if (subjects().length) {
        <table>
          <thead>
            <tr><th>Subject</th><th>Site</th><th>Visit</th><th>State</th></tr>
          </thead>
          <tbody>
            @for (row of subjects(); track row.id) {
              <tr>
                <td>{{ row.id }}</td>
                <td>{{ row.site }}</td>
                <td>{{ row.visit }}</td>
                <td>{{ row.state }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class StudyPage {
  readonly status = signal<number | null>(null);
  readonly protocol = signal("");
  readonly title = signal("");
  readonly studyStatus = signal("");
  readonly subjects = signal<{ id: string; site: string; visit: string; state: string }[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const token = readAccessToken();
    if (!token) return;
    const result = await callApi("/api/study", token);
    this.status.set(result.status);
    const body = result.body as {
      protocol?: string;
      title?: string;
      status?: string;
      subjects?: { id: string; site: string; visit: string; state: string }[];
    };
    this.protocol.set(body.protocol ?? "");
    this.title.set(body.title ?? "");
    this.studyStatus.set(body.status ?? "");
    this.subjects.set(body.subjects ?? []);
  }
}

@Component({
  selector: "app-audit",
  standalone: true,
  template: `
    <section class="card allowed">
      <h2>Audit review</h2>
      <p class="muted">API /api/audit answered {{ status() === null ? "…" : status() }}.</p>
      @if (title()) {
        <p>{{ title() }}</p>
      }
      @if (entries().length) {
        <table>
          <thead>
            <tr><th>Visit</th><th>Site</th><th>Note</th></tr>
          </thead>
          <tbody>
            @for (row of entries(); track row.id) {
              <tr>
                <td>{{ row.id }}</td>
                <td>{{ row.site }}</td>
                <td>{{ row.note }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class AuditPage {
  readonly status = signal<number | null>(null);
  readonly title = signal("");
  readonly entries = signal<{ id: string; site: string; note: string }[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const token = readAccessToken();
    if (!token) return;
    const result = await callApi("/api/audit", token);
    this.status.set(result.status);
    const body = result.body as { title?: string; entries?: { id: string; site: string; note: string }[] };
    this.title.set(body.title ?? "");
    this.entries.set(body.entries ?? []);
  }
}

@Component({
  selector: "app-denied",
  standalone: true,
  template: `
    <section class="card denied">
      <h2>Access denied</h2>
      <p>
        @if (session.user(); as user) {
          {{ user.name }} holds {{ user.roles.join(", ") }}.
        }
        This route needs one of {{ need() }}.
      </p>
      <p class="muted">
        The API still made the decision: {{ apiPath() }} answered {{ status() === null ? "…" : status() }}.
        {{ detail() }}
      </p>
    </section>
  `,
})
export class DeniedPage {
  readonly session = inject(SessionStore);
  readonly need = signal("");
  readonly status = signal<number | null>(null);
  readonly detail = signal("");
  readonly apiPath = signal("/api/study");
  private readonly route = inject(ActivatedRoute);

  constructor() {
    const from = this.route.snapshot.queryParamMap.get("from") ?? "";
    this.need.set(this.route.snapshot.queryParamMap.get("need") ?? "");
    this.apiPath.set(from.startsWith("/audit") ? "/api/audit" : "/api/study");
    void this.load();
  }

  private async load(): Promise<void> {
    const token = readAccessToken();
    if (!token) return;
    const result = await callApi(this.apiPath(), token);
    this.status.set(result.status);
    this.detail.set(messageOf(result.body));
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/angular/src/app/pages.ts";
