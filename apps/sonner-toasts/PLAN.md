# PLAN — sonner-toasts

## Goal

Single-user MVP: a Sonner toast playground — one screen with buttons that fire
toasts — to validate the scout → plan → PR pipeline for the tech_demos
monorepo.

## MVP

- Page titled "Sonner playground"
- Eight triggers: Default, Success, Error, Warning, Info, Promise (resolves
  after ~1.5s), Action (with Undo), Rich (title + description)
- `<Toaster />` mounted once in `src/main.tsx`
- Short README in the app folder with run instructions
- Self-contained: `bun install && bun run dev` works from `apps/sonner-toasts/`

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
