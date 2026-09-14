# PLAN — sonner-toasts

## Goal

Single-user MVP: a Sonner toast playground — one screen with buttons that fire
success, error, info, and promise toasts — to validate the scout → plan → PR
pipeline for the tech_demos monorepo.

## MVP

- Page titled "Sonner playground"
- Buttons: Success, Error, Info, Promise (promise resolves after ~1.5s)
- `<Toaster />` mounted once
- Short README in the app folder with run instructions
- Self-contained: `bun install && bun run dev` works from `apps/sonner-toasts/`

## Stack

- Bun as package manager/runtime
- Vite + React + TypeScript via `bunx create-vite` (official scaffold)
- `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- `sonner` for toasts; plain accessible buttons (no shadcn/ui — kept light)

## Deferred / out of scope

- Auth, routing beyond the home page
- Multi-theme systems, analytics
- Monorepo tooling overhaul
- Cloudflare deploy wiring
- shadcn/ui components
