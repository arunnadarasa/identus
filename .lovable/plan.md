# Detailed README for the identus repo

Replace the current placeholder `README.md` (a title plus a bare list of links) with a comprehensive project README. Because the repo is Git-synced, saving `README.md` in the project publishes it to `arunnadarasa/identus` on the next sync — no separate GitHub push step needed.

## What the README will contain

1. **Header** — project name, one-line description, live URL (https://identus.lovable.app), badge-style tech line (TanStack Start, React 19, Tailwind v4, Lovable Cloud).
2. **What this is** — developer hub, live demo console, admin console, landing/learn content for Hyperledger Identus SSI.
3. **Feature tour** — one short section per surface, with route paths:
   - Landing (`/`), Learn explainer with diagrams, interactive credential demo, ZK proof section (`/learn`), NHS Single Patient Record page (`/nhs`), Docs (`/docs`).
   - Console: overview, agents, DIDs, credentials, activity, sandbox (`/app/*`).
   - Agentic commerce demos: A2A, AP2, UCP, x402 on Base Sepolia (`/app/demos/*`).
4. **Three agent modes** — Simulated, Docker local, Fly.io Machines; when to use each, and the recorded decision that Fly Machines hosts agents while Sprites is only for the SDK/compose sandbox.
5. **Architecture** — diagram in a ```text block showing browser → TanStack server functions → Lovable Cloud (Postgres/auth) and → Identus Cloud Agent (simulated / Docker / Fly), plus public API routes for webhooks and x402/A2A/UCP endpoints.
6. **Project structure** — annotated tree of `src/routes`, `src/lib/identus`, `src/lib/agentic`, `src/lib/sprites`, `src/components`.
7. **Getting started** — prerequisites, install, dev server, env vars table (which are auto-provisioned by Lovable Cloud vs. which you supply: Fly token, Sprites token, AIsa key, Privy app ID, Base Sepolia RPC), with a clear note that secrets are set in Lovable rather than committed.
8. **Deploying a Cloud Agent to Fly** — the one-click flow, region/app naming, the 4GB memory requirement, Postgres init databases, public IP allocation, health-check and readiness polling, admin key rotation, and troubleshooting for the failures already hit (image auth, 400 timeouts, unreachable endpoint, orphaned apps).
9. **Docker local** — compose overview and the documented pitfalls.
10. **Data model** — table list with purpose and the fact that RLS scopes rows per user.
11. **Zero-knowledge proof demo** — Noir circuit, browser-side proving with Barretenberg UltraHonk, what is genuinely ZK vs. the JWT-VC credential layer.
12. **Security notes** — roles in a separate table, RLS, admin key handling, signature verification on public endpoints, no secrets in the client bundle.
13. **Roadmap / known limitations**, **contributing**, **useful links** (the upstream Identus links currently in the README, kept but labelled), **license**.

## Technical notes

- Single file change: `README.md` at the repo root, rewritten in full.
- Reads before writing: `src/routes/docs.tsx`, `src/lib/identus/*`, `src/lib/agentic/*`, `supabase/migrations` and `src/integrations/supabase/types.ts` so feature descriptions, env var names, and the table list are accurate rather than invented.
- No app code, routes, or database objects change; nothing in the running app is affected.
- Anchored table of contents at the top for navigation on GitHub.
