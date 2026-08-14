# Hyperledger Identus Hub

A developer hub, live demo console, admin console and public explainer for **[Hyperledger Identus](https://identus.io)** — decentralised identity (DIDs), verifiable credentials and agentic commerce, all runnable from the browser.

**Live app:** https://identus.lovable.app

Built with TanStack Start (React 19, Vite 7), Tailwind CSS v4, shadcn/ui, and Lovable Cloud (Postgres + auth) — developed in [Lovable](https://lovable.dev) with two-way GitHub sync.

---

## Contents

- [What this is](#what-this-is)
- [Feature tour](#feature-tour)
- [Three agent modes](#three-agent-modes)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deploying a Cloud Agent to Fly.io](#deploying-a-cloud-agent-to-flyio)
- [Docker local](#docker-local)
- [Data model](#data-model)
- [Zero-knowledge proof demo](#zero-knowledge-proof-demo)
- [Agentic commerce demos](#agentic-commerce-demos)
- [Security notes](#security-notes)
- [Roadmap and known limitations](#roadmap-and-known-limitations)
- [Contributing](#contributing)
- [Useful links](#useful-links)
- [License](#license)

---

## What this is

Identus is powerful but has a steep first mile: you need a Cloud Agent, a Postgres cluster, a PRISM node, published DIDs with the right key purposes, and a mental model of the SSI trust triangle before you can issue a single credential.

This project collapses that first mile into four things:

1. **A public explainer** for non-technical audiences — what self-sovereign identity is, why it matters in both web2 and web3, and a worked NHS Single Patient Record scenario.
2. **A developer hub** — docs, comparisons and copy-pasteable configuration for running an agent locally or in the cloud.
3. **A live console** — sign in, connect (or provision) an agent, create DIDs, issue and verify credentials, and watch every request in an activity log.
4. **Agentic demos** — A2A, AP2, UCP and x402 flows showing how verifiable credentials give AI agents delegated, auditable authority to transact.

Every account is isolated: all data is row-level-security scoped to the signed-in user, so the app is safe to share as a sandbox.

---

## Feature tour

### Public pages

| Route | What it does |
| --- | --- |
| `/` | Landing page. Session-aware — signed-in visitors get a direct "Open console" path. Mobile burger navigation. |
| `/learn` | Plain-English SSI explainer: the trust triangle, web2-vs-SSI flow comparison, selective disclosure, an SSI timeline, a web2/web3 opportunity split, an **interactive 5-step credential demo**, an **AI-agent section** (A2A, AP2, UCP, x402), a **zero-knowledge proof section** with a real in-browser Noir proof, and an FAQ. |
| `/nhs` | NHS England [Single Patient Record](https://www.england.nhs.uk/digitaltechnology/the-single-patient-record/) applied to SSI: the problem grid, SPR pillars, a credential map, a patient consent demo, and a selective-disclosure comparison. |
| `/docs` | Developer docs: agent mode comparison (Fly vs Docker vs Sprites), a Docker guide, and Identus API notes. |
| `/auth`, `/auth/callback` | Email/password and Google sign-in via Lovable Cloud auth. |

### Console (`/app`, authenticated)

| Route | What it does |
| --- | --- |
| `/app` | Overview: active agent card, mode recommendation, readiness watcher. |
| `/app/agents` | Manage agent connections. Add a URL + admin key, run a **health probe**, view diagnostics, deploy to Fly, adopt an existing Fly app, rotate the admin key, and switch modes — switching is gated on a successful probe. |
| `/app/dids` | Create PRISM DIDs (holder/issuer key purposes), auto-publish issuer DIDs with an `assertionMethod` key, poll publication status, and inspect long-form vs published DIDs. |
| `/app/credentials` | Issue credentials against a real issuer DID (connection-based **or** connectionless via invitation URL), accept offers as a holder, and verify presentations. |
| `/app/activity` | Chronological log of every agent request, provisioning step and credential event. |
| `/app/sandbox` | Per-user **Sprites** scratch box for Identus SDK (TypeScript) snippets, plus a **Compose Lab** for authoring and validating Docker Compose stacks. |
| `/app/demos` | Hub for the four agentic demos below. |

A **mode badge** in the navbar always shows which mode you're in (simulated / docker / fly) with a colour-coded status pill.

---

## Three agent modes

| Mode | What runs | Use it for |
| --- | --- | --- |
| **Simulated** | No agent. Server functions emulate the Identus REST API against Lovable Cloud tables (`sim_connections`, `sim_presentations`). | Learning, demos, offline work, CI. Instant, free, no infrastructure. |
| **Docker local** | `identus/identus-cloud-agent` + `identus/prism-node` + Postgres on your machine via Compose. | Local development against the real API with full control and fast iteration. |
| **Fly.io Machines** | The same three containers provisioned as Fly Machines from the console, using your `FLY_API_TOKEN`. | A real, publicly reachable Cloud Agent you can point a wallet or another agent at. |

**Recorded decision:** hosted agents run on **Fly Machines only**. Sprites is used solely for the per-user SDK snippet sandbox and Compose authoring/linting — it does not host agents, because the Identus stack needs multiple long-lived containers with a private network and a persistent Postgres volume. `/docs` explains the comparison in the app itself.

---

## Architecture

```text
                        ┌──────────────────────────────────────────┐
   Browser (React 19)   │  /  /learn  /nhs  /docs  /app/*          │
   Tailwind v4 + shadcn │  Privy wallet (lazy, client-only)        │
                        │  Noir + bb.js ZK prover (client-only)    │
                        └───────────────┬──────────────────────────┘
                                        │ typed RPC (createServerFn)
                        ┌───────────────▼──────────────────────────┐
   TanStack Start       │  src/lib/**/*.functions.ts               │
   server runtime       │  auth middleware → per-user RLS context  │
   (edge worker)        │  secrets read inside .handler() only     │
                        └───┬───────────────────────┬──────────────┘
                            │                       │
              ┌─────────────▼────────┐   ┌──────────▼───────────────────────┐
              │  Lovable Cloud       │   │  Identus Cloud Agent             │
              │  Postgres + auth     │   │  simulated | docker | fly        │
              │  RLS per user        │   │  + PRISM node + Postgres         │
              └──────────────────────┘   └──────────────────────────────────┘

   Public HTTP (no session) — src/routes/api/public/*
     /api/public/a2a-seller    JSON-RPC seller agent (A2A)
     /api/public/ucp-merchant  UCP merchant endpoint
     /api/public/x402-proxy    x402 payment-required proxy (Base Sepolia)
```

Key boundaries:

- App-internal logic uses `createServerFn` from `@tanstack/react-start`. There are no Supabase edge functions.
- `*.server.ts` modules hold server-only logic and are never imported by client code directly; `*.functions.ts` are the thin RPC wrappers components import.
- Secrets (`FLY_API_TOKEN`, `SPRITES_TOKEN`, `AISA_API_KEY`, service role) are read **inside** handlers, never at module scope, and never reach the browser bundle.
- Anything a browser-only library touches (Privy, Leaflet-style maps, the Noir/Barretenberg WASM prover) is loaded lazily behind `ClientOnly` so SSR never evaluates it.

---

## Project structure

```text
src/
  routes/
    index.tsx                 landing page
    learn.tsx                 SSI explainer (+ ZK section)
    nhs.tsx                   NHS Single Patient Record
    docs.tsx                  developer docs
    auth.tsx, auth.callback.tsx
    app.tsx                   console shell (auth gate)
    app.index.tsx             console overview
    app.agents.tsx            agent connections, modes, Fly deploy
    app.dids.tsx              DID creation + publication
    app.credentials.tsx       issue / accept / verify
    app.activity.tsx          activity log
    app.sandbox.tsx           Sprites snippets + Compose Lab
    app.demos.index.tsx       demo hub
    app.demos.a2a.tsx  .ap2.tsx  .ucp.tsx  .x402.tsx
    api/public/               unauthenticated HTTP endpoints
  lib/
    identus.functions.ts      connections, DIDs, credentials, schemas, readiness
    identus/
      agent.server.ts         Identus REST client + simulated backend
      fly.server.ts           Fly Machines API, images, machine configs
      fly.functions.ts        provision, repair, adopt, rotate, logs, destroy
      types.ts
    agentic/
      types.ts  ap2.ts  ucp-sign.server.ts  ucp-verify.ts  x402.ts
      aisa.server.ts          LLM rationales for agent negotiation
      a2a.functions.ts        negotiation, mandates, session log
      credentials.server.ts  negotiation.server.ts  hash.ts
    sprites/
      sprites.server.ts  workspace.server.ts
      sandbox.functions.ts    per-user SDK scratch box
      compose.functions.ts  compose.server.ts   Compose Lab + YAML validation
  components/
    AppShell.tsx  ModeBadge.tsx  StickyActionBar.tsx  MonoValue.tsx
    Agent*/Fly*                 health, diagnostics, deploy, logs, adopt, rotate
    learn/                      diagrams, credential demo, ZK proof
    nhs/                        SPR pillars, consent demo, credential map
    agentic/                    demo panels
    ui/                         shadcn primitives
  data/x402.json                Base Sepolia config (USDC, RPC, explorer)
supabase/migrations/            schema, RLS policies, grants
```

---

## Getting started

Prerequisites: **Node.js 20+** (or Bun), and Docker only if you want the local agent mode.

```sh
git clone https://github.com/arunnadarasa/identus.git
cd identus
npm install
npm run dev          # http://localhost:8080
```

The app boots in **simulated mode** with no configuration — sign up, create a DID, issue a credential. Real agent modes need the environment variables below.

The easiest way to develop is still the [Lovable editor](https://lovable.dev/projects/abda5469-f7b0-4cb1-98ba-916ab1137f4e): every change there is committed to this repo, and every push to `main` syncs back.

---

## Environment variables

**Do not commit secrets.** Server-side values are stored in Lovable's secret manager and injected into the server runtime; only `VITE_`-prefixed values ever reach the browser.

### Provisioned automatically by Lovable Cloud

| Variable | Notes |
| --- | --- |
| `VITE_SUPABASE_URL` | Backend URL (public). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (public, RLS-protected). |
| `VITE_SUPABASE_PROJECT_ID` | Public project identifier. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server-side equivalents. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-only key; used only where RLS must be bypassed intentionally. Not retrievable through the app. |
| `LOVABLE_API_KEY` | Server-only; used for the AI gateway and connectors. |

### You supply (per feature)

| Variable | Needed for | Format |
| --- | --- | --- |
| `FLY_API_TOKEN` | Fly.io mode: list orgs, provision/repair/destroy machines, allocate IPs. | Fly **org** token (`FlyV1 ...`). |
| `SPRITES_TOKEN` | Sandbox + Compose Lab. | The 4-part sprites.dev token: `org-slug/org-id/token-id/token-value`. Never a Fly token. |
| `AISA_API_KEY` | LLM-written rationales in the A2A/AP2 negotiation demos. | Provider API key. Optional — demos fall back to deterministic text. |
| `PRIVY_APP_ID` | Wallet connection for the x402 / AP2 signing demos. | Privy app ID. |

Base Sepolia settings (USDC address, chain ID, Alchemy RPC, faucet, explorer) live in `src/data/x402.json` — these are public network values, not secrets.

After changing a server secret, **publish** the app for the change to reach production; preview picks it up immediately.

---

## Deploying a Cloud Agent to Fly.io

From `/app/agents` → **Fly.io** tab, one click provisions a dedicated three-machine stack. What happens, in order:

1. **Preflight** — validate `FLY_API_TOKEN`, list organisations, pick a region and app name.
2. **Create app + private network** — machines talk over Fly's 6PN private IPv6; internal hostnames are resolved to 6PN addresses rather than relying on `.internal` DNS suffixes.
3. **Postgres machine** — `postgres:13-alpine` with an init step that creates every database Identus expects (`pollux`, `connect`, `agent`, `node_db`, …). **Postgres is pinned to 13**: Identus 1.40's Flyway migration `V27` uses a bare `format json` column, which is a syntax error (SQLSTATE 42601) on Postgres 16, killing the agent mid-migration.
4. **Wait for Postgres** — explicit readiness gate before anything else starts.
5. **PRISM node** — `docker.io/identus/prism-node:2.5.0`.
6. **Cloud Agent** — `docker.io/identus/identus-cloud-agent:1.40.0`, sized **4 vCPU / 4096 MB**. Anything smaller OOMs during startup.
7. **Allocate public IPs** — shared IPv4 + IPv6, so the endpoint is reachable from the browser.
8. **Readiness polling** — exponential backoff with a per-request cap; the machine-state wait is chunked so no single Fly API call exceeds its timeout.
9. **Health probe** — the connection is only marked usable after `probeAgent` succeeds.

Images are pinned to **Docker Hub**, not GHCR: the `hyperledger-identus` GHCR packages are not anonymously pullable and Fly reports it as `failed to get manifest ...: unauthorized`.

### Operations available in the UI

- **Live provisioning logs** — every step with status, duration, endpoint and raw API response.
- **Machine diagnostics** — per-machine state, guest size, image, and a **Repair** action that recreates an undersized or crashed agent machine.
- **Allocate IPs** — for apps created without a public address.
- **Use this agent** — adopt an existing Fly app: saves its URL and admin key as your active connection.
- **Rotate admin credentials** — generate a new admin API key, update the machine config, and store the new key.
- **Presence badge** — flags connections whose Fly app no longer exists (destroy handles 404 gracefully so orphans can be cleaned up).

### Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Fly API 400 ... unauthorized` on image pull | GHCR image. Use the pinned Docker Hub images. |
| `Fly API 400` mentioning a 120s timeout | A single wait call exceeded Fly's limit — readiness polls are capped at 60s and chunked. |
| Machines started but endpoint unreachable | No public IP allocated. Use **Allocate IPs**. |
| Agent machine restarts forever | Memory. It needs 4096 MB; use **Repair**. |
| Agent dies during migration | Postgres version. Must be 13. |
| App shows in the console but not on Fly | Orphaned connection — the presence badge flags it; destroy removes it locally. |

---

## Docker local

`/docs` carries the full guide; the short version:

- Bring up Postgres, `prism-node` and `identus-cloud-agent` with Compose, pinning the same image versions and Postgres 13 as above.
- Create the Identus databases in the Postgres init step, not after the fact.
- Give the agent container at least 4 GB.
- Expose the agent's REST port and set the admin API key; paste both into `/app/agents` and run the health probe.

**Compose Lab** (`/app/sandbox`) validates Compose YAML — structure, required services, image pins, memory hints — before you run it, and can adopt the resulting local endpoint as your active connection.

---

## Data model

All tables live in `public`, have RLS enabled, explicit `GRANT`s, and policies scoped to `auth.uid()`.

| Table | Purpose |
| --- | --- |
| `profiles` | User profile row created by a trigger on sign-up. |
| `user_roles` | Roles in a **separate** table (`app_role` enum) read via a `security definer` `has_role()` function — never stored on the profile. |
| `agent_connections` | Saved agents: label, mode, base URL, admin key, active flag, health state. |
| `saved_dids` | Created DIDs: long-form and published DID, key purposes, publication status, `publish_error`. |
| `credential_schemas` | Credential schema definitions. |
| `credential_records` | Offers, issuance and acceptance state, including `invitation_url` for connectionless offers. |
| `sim_connections`, `sim_presentations` | Backing store for simulated mode. |
| `activity_log` | Append-only audit trail of agent requests and console actions. |
| `sprite_boxes`, `sprite_snippets` | Per-user Sprites sandbox and saved SDK snippets. |
| `compose_files` | Saved Compose Lab documents. |
| `agentic_sessions` | A2A/AP2/UCP/x402 demo runs, mandates and signatures. |

Migrations are in `supabase/migrations/` and are applied in filename order.

---

## Zero-knowledge proof demo

`/learn#zk` contains a **real** zero-knowledge proof, generated and verified entirely in your browser:

- **Circuit** — `src/components/learn/zk-circuit.ts`: a Noir program with a private `dob_year` and a public `threshold_year`, asserting `dob_year <= threshold_year`.
- **Prover** — compiled with `@noir-lang/noir_wasm`, executed with `@noir-lang/noir_js`, proved and verified with Aztec `@aztec/bb.js` UltraHonk (`threads: 1`, so no COOP/COEP headers are required).
- **What you see** — a step log (compile → witness → prove → verify), the real proof size and public inputs (~14.6 KB, 1 public input), a **Tamper** button that flips a byte and shows verification fail, and an under-18 input that shows no proof can be produced at all (`Cannot satisfy constraint`).
- **Loading** — everything sits behind `ClientOnly` + `lazy`, with the multi-megabyte WASM fetched only when you press the button.

Alongside it, `ProofCompare` contrasts a standard credential (all fields visible) with a zero-knowledge presentation (`Over 18? = true` plus π).

**Honest framing, stated in the UI:** the proof above is genuinely zero-knowledge, but the live console issues **JWT-VC** credentials, which do selective disclosure rather than ZK. AnonCreds and BBS+ are the ZK-capable credential formats that let a proof like this be bound to an issued credential.

---

## Agentic commerce demos

`/app/demos` — four flows showing verifiable credentials as the trust layer for AI agents.

| Demo | What it shows |
| --- | --- |
| **A2A** | Agent-to-agent negotiation over JSON-RPC against `/api/public/a2a-seller`, with an agent card, DID-identified participants and LLM-written rationales. |
| **AP2** | Agent Payments Protocol mandates: intent → cart → payment mandate, signed EIP-712 and verified server-side. |
| **UCP** | Universal Commerce Protocol merchant flow against `/api/public/ucp-merchant`, with signed and verified payloads. |
| **x402** | HTTP 402 payment-required flow on **Base Sepolia**: a wallet connected through Privy pays USDC, the proxy retries with the payment header, and the content unlocks. |

Public endpoints validate their input and verify signatures inside the handler — the `/api/public/*` prefix bypasses site auth, so the handler is the only gate.

---

## Security notes

- **Roles in a separate table.** `user_roles` + `has_role()` (`security definer`, fixed `search_path`). Roles are never on `profiles`, and admin status is never inferred from client storage.
- **RLS everywhere.** Every table has policies scoped to `auth.uid()` plus explicit grants; `anon` gets access only where a policy deliberately allows it.
- **Admin agent keys** are stored per connection, revealed only through an explicit server function, and rotatable from the UI.
- **Secrets stay server-side.** Read inside `.handler()` bodies, never at module scope, never `VITE_`-prefixed.
- **Public endpoints** verify signatures and validate bodies before doing any work, and never return PII.
- **No LLM is required** to run Identus. The AI key only writes human-readable negotiation rationales in the demos.

---

## Roadmap and known limitations

- Credentials are JWT-VC; AnonCreds/BBS+ (and therefore credential-bound ZK presentations) are not wired into the console yet.
- Mediator and DIDComm routing are not provisioned — connectionless offers via invitation URL are the supported path.
- Sprites hosts SDK snippets and Compose authoring only; it does not run agents.
- Fly provisioning is single-region and single-machine per role; no HA Postgres.
- The Noir prover downloads several megabytes of WASM on first use.

---

## Contributing

Issues and pull requests are welcome. Please keep the existing patterns: TanStack Start server functions for app-internal logic, `src/routes/api/public/*` for external callers, semantic design tokens rather than hardcoded colours, and a migration (with `GRANT`s) for every schema change. Changes pushed to `main` sync back into Lovable, so keep commits focused.

---

## Useful links

**This project**

- Live app — https://identus.lovable.app
- Lovable project — https://lovable.dev/projects/abda5469-f7b0-4cb1-98ba-916ab1137f4e

**Hyperledger Identus**

- Documentation — https://identus.io/documentation/develop/
- Docs repo — https://github.com/hyperledger-identus/docs
- Umbrella repo — https://github.com/hyperledger-identus/hyperledger-identus
- Cloud Agent — https://github.com/hyperledger-identus/cloud-agent
- TypeScript SDK — https://github.com/hyperledger-identus/sdk-ts
- Kotlin Multiplatform SDK — https://github.com/hyperledger-identus/sdk-kmp
- Mediator — https://github.com/hyperledger-identus/mediator

**Related standards and platforms**

- NHS England Single Patient Record — https://www.england.nhs.uk/digitaltechnology/the-single-patient-record/
- Noir (zero-knowledge) — https://noir-lang.org/docs
- Fly Machines API — https://fly.io/docs/machines/api/
- x402 — https://www.x402.org
- Base Sepolia faucet — https://faucet.circle.com/

---

## License

Apache-2.0, matching upstream Hyperledger Identus. See `LICENSE` if present, or open an issue if you need a different arrangement.
