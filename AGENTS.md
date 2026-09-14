# tech_demos — agent guide

Monorepo of small, self-contained tech demos.

## Layout

- `apps/<demo-name>/` — one folder per demo app. Each app is fully self-contained: `bun install && bun run dev` must work from inside the app folder.
- `skills/` — reusable planning/process notes for agents.
- `tracking/seen-bookmarks.json` — ledger of demo ideas: `proposed` and `built`.

## Rules

- Never touch apps unrelated to your task.
- Bun is the package manager/runtime. Before any `bun install`/`bun add` in an app, ensure the app has a `bunfig.toml` with `[install] minimumReleaseAge = 259200`.
- Prefer minimal, official scaffolds (e.g. `bunx create-vite`) over hand-rolled setups.
- Each app ships with its own `README.md` (how to run) and `PLAN.md` (goal, MVP, stack, deferred).
- One PR per demo against the default branch, with screenshot + video validation artifacts.
