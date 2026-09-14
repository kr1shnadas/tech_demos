# Sonner toasts

One-screen playground for [Sonner](https://sonner.emilkowal.ski/) toasts:
eight triggers covering default, success, error, warning, info, promise
(~1.5s, alternating success and failure so both paths are visible), action
(with Undo), and rich (title + description) toasts.

## Run

Requires [Bun](https://bun.sh).

```bash
cd apps/sonner-toasts
bun install
bun run dev
```

Then open the printed URL (default http://localhost:5173) and click the
buttons.

## Stack

- Vite + React + TypeScript (scaffolded with `bun create vite`, react-ts template)
- Tailwind CSS v4 (`@tailwindcss/vite`)
- shadcn/ui: `button` + `sonner` (Toaster) only
- `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- `bunfig.toml` pins `[install] minimumReleaseAge = 259200` (3 days) for
  supply-chain safety

## Layout

- `src/main.tsx` — mounts `<Toaster />` + `<App />`
- `src/App.tsx` — the single screen
- `src/components/toast-playground.tsx` — the eight toast triggers (Promise
  alternates resolve/reject; each click is an independent promise)
- `src/components/ui/button.tsx`, `src/components/ui/sonner.tsx` — shadcn components
- `src/lib/utils.ts` — `cn()` helper
