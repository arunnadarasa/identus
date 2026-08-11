# Hyperledger Identus App

An Identus developer hub combining four things: a docs/dev portal, a live SSI demo (DIDs, credentials, verification), an admin console over the Cloud Agent API, and a landing page.

The app supports three agent modes, switchable per connection in Settings.

## The three agent modes

**1. Simulated** (default, works instantly)
A deterministic in-app agent that mimics the Cloud Agent REST API: realistic `did:prism:` values, JWT-shaped credentials, connection/issuance/presentation state transitions. Every screen is usable with no infrastructure.

**2. Docker local**
For an agent running on your machine (`hyperledger-identus/cloud-agent` compose stack, typically `http://localhost:8080/cloud-agent`). Settings holds the base URL + admin API key; a "Test connection" button hits `/_system/health`. The app shows a copyable setup guide (compose command, ports, env vars, optional mediator container). Note: a localhost agent is only reachable while you use the app locally.

**3. Fly.io**
For an agent deployed on Fly, and the app helps you get there. Using your Fly organisation token (stored as a secret, used only server-side):
- A "Provision on Fly" wizard calls the Fly Machines REST API (`api.machinery.fly.dev`) to create an app in your org, attach a Postgres/volume, and start a `hyperledger-identus/identus-cloud-agent` machine with the required env (`API_KEY_ENABLED`, admin key, DB config, PRISM node).
- Progress panel polls machine state and the agent's health endpoint until it reports healthy, then saves the resulting `https://<app>.fly.dev/cloud-agent` URL as an agent connection automatically.
- Also supports "I already have one on Fly": paste app name, the app resolves the URL and verifies health.
- Guides for scaling down/suspending machines to control cost, and a delete action.

Note on `fly mcp launch`: that command launches MCP servers on Fly, which is a different thing from the Identus agent — not used here. If you later want this app itself exposed as an MCP server, that's a separate feature.

## Pages

1. **Landing** (`/`) — what Identus is, the SSI trust triangle, feature highlights, CTAs to demo and docs.
2. **Docs portal** (`/docs`, `/docs/$slug`) — in-app guides: concepts (DIDs, VCs, DIDComm), architecture (Cloud Agent, Mediator, PRISM node), SDKs (`sdk-ts`, `sdk-kmp`), quickstart, "Run locally with Docker", "Deploy on Fly.io". Each links out to identus.io and the GitHub repos.
3. **Demo / Wallet** (`/demo`) — end-to-end walkthrough: create a DID, connect, issue a credential, present and verify, with a live step timeline. Works in any mode.
4. **Console** (`/console`) — admin surface over the agent API: DIDs, connections, credential offers/records, presentations, schemas, with create actions and detail drawers.
5. **Agents** (`/agents`) — the three-mode connection manager: list connections, add one (simulated / docker / fly), test health, set active, plus the Fly provisioning wizard.
6. **Auth** (`/auth`) — email/password sign in and sign up, plus Google.

## Accounts and data (Lovable Cloud)

Enable Lovable Cloud for auth plus these RLS-scoped tables:

- `profiles` — display name, created on signup via trigger
- `agent_connections` — name, `mode` (`simulated` | `docker` | `fly`), base_url, wallet_id, fly_app_name, is_active; API key held server-side
- `activity_log` — every agent operation (kind, request/response summary, status, timestamp) powering the demo timeline and console history
- `saved_dids`, `credential_records` — local mirrors so history survives agent restarts
- `sim_state` — tables backing the simulated agent
- `user_roles` + `has_role()` — roles in their own table

Seed data: a simulated connection plus sample credential history so the console and demo are populated on first login.

## Technical notes

- All agent and Fly calls go through `createServerFn` handlers with `requireSupabaseAuth`. Neither the agent API key nor the Fly token ever reaches the browser.
- One `AgentClient` interface, three implementations: `SimulatedAgent`, and `RestAgent` used for both docker and fly modes (same REST surface, different base URL/reachability); mode only changes provisioning and health guidance.
- Fly token stored via secrets (`FLY_API_TOKEN`) and read inside handlers; provisioning implemented as discrete idempotent steps so the wizard can resume.
- Console/demo reads use route loaders with `ensureQueryData`; mutations use `useServerFn` + invalidation. Protected routes under `_authenticated`.
- Docs content lives in typed TS modules, rendered with a shared prose layout and sidebar.
- Per-route `head()` metadata with unique titles/descriptions; JSON-LD on docs pages.
- Design: dark technical aesthetic — deep ink surfaces, one teal-cyan accent for verified/identity states, mono type for DIDs and JSON, semantic tokens only in `src/styles.css`.

## Build order

1. Enable Lovable Cloud, migration (schema + RLS + grants + seed), auth page and guard
2. Design system, landing page, docs portal
3. Agent abstraction + simulated agent + `/agents` connection manager with health tests
4. Console screens
5. Demo walkthrough with activity timeline
6. Fly.io provisioning wizard (needs your org token)
