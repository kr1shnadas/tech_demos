# Sonner playground

One-screen playground for [Sonner](https://sonner.emilkowal.ski/) toasts:
buttons that fire success, error, info, and promise toasts (promise resolves
after ~1.5s).

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

Vite + React + TypeScript, `sonner` for toasts. `bunfig.toml` pins
`[install] minimumReleaseAge = 259200` (3 days) for supply-chain safety.
