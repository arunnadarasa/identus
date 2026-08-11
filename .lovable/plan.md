# Hyperledger Identus App

An Identus developer hub that combines four things in one app: a docs/dev portal, a live SSI demo (DIDs, credentials, verification), an admin console over the Cloud Agent API, and a landing page.

Because you don't have a Cloud Agent yet, the app ships with a **Simulated Agent** mode that behaves like the real REST API, so every screen works from day one. Switch to a real agent later by pasting its URL and API key — no code changes.

## About running a real Cloud Agent

The Identus Cloud Agent is a JVM service that runs as Docker containers (agent + PostgreSQL + PRISM node, and a separate Mediator for DIDComm). It cannot run inside Lovable Cloud. Options, shown in the app's "Run your own agent" guide:

- Local: `docker compose` from the `hyperledger-identus/cloud-agent` repo (fastest to try)
- Hosted: any VM or container host (Fly.io, Render, AWS ECS, Hetzner)

The app talks to whichever endpoint you configure.

## Pages

1. **Landing** (`/`) — what Identus is, the SSI flow, feature highlights, CTAs to the demo and docs.
2. **Docs portal** (`/docs`, `/docs/$slug`) — curated guides written in-app: concepts (DIDs, VCs, DIDComm, trust triangle), architecture (Cloud Agent, Mediator, PRISM node), SDKs (`sdk-ts`, `sdk-kmp`), quickstart, and "Run your own agent". Each page links out to identus.io and the GitHub repos.
3. **Demo / Wallet** (`/demo`) — end-to-end walkthrough: create a DID, establish a connection, issue a credential, present and verify it, with a step-by-step visual of the holder/issuer/verifier triangle. Runs against the simulated agent or your real one.
4. **Console** (`/console`) — admin surface over the agent API: DIDs, connections, credential offers/records, presentations, and schemas, with create actions and detail drawers.
5. **Settings** (`/settings`) — agent connections: name, base URL, API key, wallet id; test-connection button; pick the active one.
6. **Auth** (`/auth`) — email/password sign in and sign up.

## Accounts and data (Lovable Cloud)

Enable Lovable Cloud for auth plus these tables, all RLS-scoped to the owner:

- `profiles` — display name, created on signup via trigger
- `agent_connections` — name, base_url, wallet_id, is_active, api key stored server-side
- `activity_log` — every agent operation: kind, request summary, response summary, status, timestamp (powers the demo timeline and console history)
- `saved_dids`, `credential_records` — local mirrors of what the user created, so history survives an agent restart
- `user_roles` + `has_role()` — separate roles table, admin-only bits later

Seed data: a demo agent connection in simulated mode and a sample credential history so the console and demo are populated on first login.

## Technical notes

- All agent calls go through `createServerFn` handlers (`src/lib/identus.functions.ts`) using `requireSupabaseAuth`. API keys never reach the browser; they're read server-side from the stored connection.
- A single `agentClient` abstraction with two implementations: `RestAgent` (fetch against `/cloud-agent` REST: `/did-registrar/dids`, `/connections`, `/issue-credentials/credential-offers`, `/present-proof/presentations`, `/schema-registry/schemas`) and `SimulatedAgent` (in-database deterministic mock producing realistic `did:prism:` values, JWT-shaped credentials, and state transitions).
- Console/demo reads use route loaders with `ensureQueryData`; mutations use `useServerFn` + query invalidation. Protected routes live under `_authenticated`.
- Docs content lives in typed TS modules (no CMS), rendered with a shared prose layout and sidebar nav.
- Per-route `head()` metadata with unique titles/descriptions for SEO; JSON-LD on docs pages.
- Design: dark technical aesthetic — deep slate/ink surfaces, a single teal-cyan accent for identity/verified states, mono type for DIDs and JSON, semantic tokens only in `src/styles.css`.

## Build order

1. Enable Lovable Cloud, migration for schema + RLS + grants + seed, auth page and guard
2. Design system, landing page, docs portal
3. Agent abstraction + simulated agent + settings page with connection test
4. Console screens
5. Demo walkthrough with activity timeline
