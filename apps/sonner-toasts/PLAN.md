# PLAN — sonner-toasts

## Goal

Single-user MVP: a Sonner toast playground — one screen with buttons that fire
toasts — to validate the scout → plan → PR pipeline for the tech_demos
monorepo.

## MVP — BA acceptance tickets

1. **Scaffold & run** — App scaffolded under `apps/sonner-toasts/` with
   `bun create vite` (react-ts). `bun install && bun run dev` works from the
   app folder, the home page loads, and the README documents how to run.
2. **Sonner wired up** — `sonner` installed; `<Toaster />` mounted exactly
   once at the root (`src/main.tsx`); the Default trigger acts as the smoke
   toast; toasts use readable shadcn-token styling with rich colors.
3. **Success + Error** — Distinct copy per button ("Everything worked!" vs
   "Something went wrong"), rendered with the shadcn `Button` component.
4. **Promise paths** — Promise trigger shows loading → success and, on
   alternating clicks, loading → error (reject path). Each click creates an
   independent promise so clicking while one is in flight is stable, and an
   explicit catch guarantees no unhandled rejections.
5. **Single screen** — Page heading is "Sonner toasts"; Success, Error, and
   Promise are visible on a typical laptop viewport without scrolling. No
   themes, auth, extra routing, or analytics.

## Stack (architect-approved)

- Bun as package manager/runtime (not Next)
- Vite + React + TypeScript via `bun create vite` react-ts template
- `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- Tailwind CSS v4 + shadcn/ui, limited to `button` and `sonner` (Toaster)
- Deps: sonner, class-variance-authority, clsx, tailwind-merge, lucide-react
- Layout: `main.tsx` mounts Toaster + App; `App.tsx` one screen;
  `components/ui/button.tsx` + `components/ui/sonner.tsx`;
  `components/toast-playground.tsx` with the triggers; `lib/utils.ts` `cn()`

## Deferred / out of scope

- Auth, routing beyond the home page
- Multi-theme systems (theme toggle), analytics
- Monorepo tooling overhaul
- Cloudflare deploy wiring
- Additional shadcn components beyond button + sonner
