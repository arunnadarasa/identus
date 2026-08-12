---
name: hyperledger-identus
description: Use when deploying, debugging, or extending the Hyperledger Identus console — provisioning Fly Machines agents, calling the Cloud Agent REST API, running Sprites SDK sandboxes, or adding DID/credential/connection flows. Triggers on "identus", "cloud agent", "prism node", "did:prism", "sprites sandbox", "fly agent", "credential issuance", "compose lab".
---

# Hyperledger Identus console

## When to use

- Deploying or debugging an Identus Cloud Agent (Fly Machines, Docker local, or simulated).
- Calling the Cloud Agent REST API: DIDs, connections, credential offers, presentations, health.
- Running Identus TypeScript SDK snippets in the Sprites.dev sandbox.
- Extending the console with new Identus features or pages.
- Authoring or validating a Docker Compose stack for the Identus components.

## Stack overview

Identus is self-sovereign identity infrastructure: a Cloud Agent (Scala REST service) backed by Postgres and a PRISM node, an optional Mediator for DIDComm, and edge-agent SDKs (TypeScript/Kotlin/Swift). The console supports three `agent_connections.mode` values:

- **`simulated`** — in-app mock backed by Supabase tables; no external service. Always healthy.
- **`docker`** — a local `docker compose` stack reached at `http://localhost:8085/cloud-agent`. Localhost only; external DIDComm peers need a tunnel.
- **`fly`** — a dedicated Fly Machines deployment (Postgres + prism-node + cloud-agent machines). Serves HTTPS at the root, no `/cloud-agent` prefix.

Fly Machines hosts the full agent stack. Sprites.dev is only for per-user SDK snippet sandboxes and Compose Lab authoring — it cannot run container images or multi-service stacks.

## Key file map

| Layer | Location |
| --- | --- |
| Raw clients (Node-only) | `src/lib/identus/*.server.ts`, `src/lib/sprites/*.server.ts` |
| Client-callable wrappers | `src/lib/identus.functions.ts`, `src/lib/identus/fly.functions.ts`, `src/lib/sprites/*.functions.ts` |
| Shared types | `src/lib/identus/types.ts` |
| Console routes | `src/routes/app.*.tsx` (agents, dids, credentials, sandbox, activity, index) |
| Docs route | `src/routes/docs.tsx` |
| UI components | `src/components/` (FlyDeployPanel, FlyMachineDiagnostics, AgentHealthPanel, AgentReadinessWatcher, ActiveAgentCard, FlyAgentPicker, RotateKeyDialog, ComposeLabPanel, SnippetRunner, ModeRecommendation) |
| DB migrations | `supabase/migrations/` |

## Server/client split rule

Routes and components import **only** from `*.functions.ts` and `*/types.ts` — never directly from `*.server.ts`. The `*.server.ts` files read `process.env` and use the Supabase admin client; importing them into the client bundle leaks secrets and breaks the build. Each `*.functions.ts` wraps raw logic with `createServerFn({ method })` from `@tanstack/react-start`.

When adding a feature: put raw logic in `*.server.ts`, expose it via `createServerFn` in the matching `*.functions.ts`, and import the function from the route. Read env vars inside the handler, not at module scope.

## Environment variables / secrets

- `FLY_API_TOKEN` — Fly Machines + GraphQL API auth. Required for Fly provisioning.
- `SPRITES_TOKEN` — must be the 4-part `org-slug/org-id/token-id/token-value` token from sprites.dev/account. A raw Fly token will not work and returns 401.
- `AGENT_BASE_URL`, `AGENT_API_KEY` — placeholders injected into generated SDK snippets for the Sprites sandbox; not read by the main server.
- Agent-side deploy env (set by Fly machine config): `POSTGRES_*`, `POLLUX_DB_*`, `CONNECT_DB_*`, `AGENT_DB_*`, `PRISM_NODE_HOST/PORT`, `ADMIN_TOKEN`, `DEFAULT_WALLET_AUTH_API_KEY`, `JAVA_TOOL_OPTIONS`, `REST_SERVICE_URL`, `DIDCOMM_SERVICE_URL`.

## External APIs and pinned images

- Fly Machines API: `https://api.machines.dev/v1`
- Fly GraphQL API: `https://api.fly.io/graphql`
- Sprites.dev API: `https://api.sprites.dev/v1`
- Docker Hub images (pinned — GHCR is not anonymously pullable): `docker.io/identus/identus-cloud-agent:1.40.0`, `docker.io/identus/prism-node:2.5.0`, `postgres:16-alpine`.

## Database tables

All RLS-scoped by `user_id` (service_role has full access): `profiles`, `user_roles` (+ `app_role` enum + `has_role()`), `agent_connections`, `activity_log`, `saved_dids`, `credential_records`, `sim_connections`, `sim_presentations`, `credential_schemas`, `sprite_boxes`, `sprite_snippets`, `compose_files`.

## Hard-won invariants

- Strip `/cloud-agent` from stored Fly URLs — `agentBaseUrl()` does this for `mode === "fly"` because direct Fly deploys serve at root (no APISIX gateway).
- JVM must prefer IPv6 on Fly's private 6PN network: `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv6Addresses=true -Djava.net.preferIPv4Stack=false -XX:MaxRAMPercentage=70` on both prism-node and cloud-agent.
- Health-check `grace_period` is `300s` — first boot migrates four databases; a shorter period makes Fly restart mid-migration.
- GHCR images require auth; use the public Docker Hub tags with explicit versions, never `:latest`.
- Postgres init creates four databases (`pollux`, `connect`, `agent`, `node`) to avoid schema-migration collisions.
- Agent memory default is 4 GB; lower values get OOM-killed during first-boot migration.

For deeper detail see the reference cards: [fly-machine-config](references/fly-machine-config.md), [agent-api-surface](references/agent-api-surface.md), [sprites-quirks](references/sprites-quirks.md), [failure-modes](references/failure-modes.md).

## Workflows

### 1. Deploy a Fly.io Identus agent

1. Verify `FLY_API_TOKEN` secret exists (check project secrets).
2. Call `provisionFlyAgent` in `src/lib/identus/fly.functions.ts` with region, app name, and admin credentials.
3. The function creates: Fly app → allocates shared IPv4 + v6 → Postgres machine → prism-node machine → cloud-agent machine.
4. Poll readiness via `awaitAgentReady` (in `src/lib/identus.functions.ts`) or the `AgentReadinessWatcher` component.
   **Success:** `readiness_status === "ready"` and all four probe checks (system, did-registrar, issuance, connections) pass.

### 2. Debug an unhealthy Fly agent

1. Run `flyMachineDiagnostics` for the app name.
2. Inspect per-machine state, Fly health-check `output`, and events (`oomKilled`, `exitCode`).
3. Apply the diagnosis: OOM → redeploy with 4 GB+ memory; crash-loop → verify `JAVA_TOOL_OPTIONS` and DB init; unauthorized → verify the Docker Hub image tag and token.
4. Cross-check `agentBaseUrl()` strips `/cloud-agent` for `mode === "fly"`.
   See [failure-modes](references/failure-modes.md) for the full heuristic.

### 3. Rotate admin API key on a Fly agent

1. Call `rotateFlyAdminKey` — mints a 32-char key, updates Fly machine env (`ADMIN_TOKEN`, `DEFAULT_WALLET_AUTH_API_KEY`), restarts the machine, verifies health.
2. The stored `agent_connections` row is updated with the new key.
   **Success:** health probe returns 200 with the new key.

### 4. Add a new Identus console page or flow

1. Add types to `src/lib/identus/types.ts` if needed.
2. Implement raw logic in `src/lib/identus/*.server.ts`.
3. Expose via `createServerFn` in `src/lib/identus.functions.ts`.
4. Create route `src/routes/app.<feature>.tsx`; import only from `*.functions.ts` / `types.ts`.
5. Add a nav link in `src/components/AppShell.tsx` if it belongs in the console.

### 5. Use the Sprites sandbox for SDK snippets

1. Verify `SPRITES_TOKEN` is the 4-part format.
2. Call `ensureSandbox` to create/retrieve the user's box.
3. SDK snippets read `AGENT_BASE_URL` and `AGENT_API_KEY` from `process.env` — the sandbox injects the active agent's credentials.
4. Run via the Sprites exec endpoint; parse the `0x03 <exitCode>` framing. See [sprites-quirks](references/sprites-quirks.md).

### 6. Author or validate a Docker Compose file

1. Use `DEFAULT_COMPOSE` in `src/lib/sprites/compose.server.ts` as the canonical Identus stack template (agent + prism-node + postgres with healthchecks, named network, `restart: unless-stopped`).
2. Validate with the Python validator: flags insecure passwords, missing healthchecks, weak dependency conditions.
3. Save to `compose_files` table. Do not attempt to run containers inside Sprites — it is for authoring/linting only.
