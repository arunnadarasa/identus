# Create the `hyperledger-identus` Lovable skill

Capture the Identus-specific conventions, API patterns, and runbooks from this project into a reusable skill so future agents can extend the console, debug deployments, and add new Identus features without re-deriving the architecture each time.

## What the skill will cover

A single skill with a reference section plus workflow cards for the four areas the user selected:

1. **Deploy / host Identus agents** — simulated, Docker local, and Fly Machines provisioning.
2. **Use the Identus Cloud Agent API** — REST endpoints, health probes, DIDs, connections, credentials.
3. **Sprites SDK sandbox** — per-user snippet boxes, compose lab, env injection.
4. **Project conventions** — file layout, server/client split, types, DB schema, env vars.

## Skill shape

```text
.agents/skills/hyperledger-identus/
├── SKILL.md                 # triggers, reference, workflows
└── references/              # deeper cards loaded on demand
    ├── fly-machine-config.md
    ├── agent-api-surface.md
    ├── sprites-quirks.md
    └── failure-modes.md
```

`SKILL.md` will be the primary retrieval target. References will be short (under 120 lines each) and linked from `SKILL.md` so the body stays focused.

## Reference content for SKILL.md

- **When to use** — concrete triggers: "deploy Identus agent", "debug Fly agent health", "add DID/credential flow", "Sprites sandbox", "Identus Cloud Agent API".
- **Stack overview** — Cloud Agent, PRISM node, Mediator, SDKs; the three modes (`simulated`, `docker`, `fly`) and when each fits.
- **Key file map** — `src/lib/identus/*.server.ts` (raw clients), `src/lib/identus/*.functions.ts` (`createServerFn` wrappers), `src/lib/identus/types.ts`, route files `src/routes/app.*.tsx`, UI components under `src/components/`.
- **Server/client split rule** — routes import only `*.functions.ts` and `*/types.ts`, never `*.server.ts`; env vars are read inside handlers.
- **Environment variables / secrets** — `FLY_API_TOKEN`, `SPRITES_TOKEN` (4-part sprites.dev format), agent-side env injected by Fly machine config.
- **External APIs and pinned images** — Fly Machines API, Fly GraphQL, Sprites.dev API, Docker Hub images `identus/identus-cloud-agent:1.40.0`, `identus/prism-node:2.5.0`, `postgres:16-alpine`.
- **Database tables** — `agent_connections`, `saved_dids`, `credential_records`, `sim_connections`, `sim_presentations`, `credential_schemas`, `activity_log`, `sprite_boxes`, `sprite_snippets`, `compose_files`; all RLS-scoped by `user_id`.
- **Hard-won invariants** — strip `/cloud-agent` for Fly URLs, JVM IPv6 flags on Fly, 300s health-check grace period, GHCR images are not anonymous, multi-database Postgres init (`pollux`, `connect`, `agent`, `node`).

## Workflow cards for SKILL.md

1. **Deploy a Fly.io Identus agent**
   - Verify `FLY_API_TOKEN` secret exists.
   - Use `provisionFlyAgent` from `src/lib/identus/fly.functions.ts`.
   - Pass region, app name, admin credentials; function creates app → Postgres machine → PRISM node machine → agent machine.
   - Poll readiness via `awaitAgentReady` / `AgentReadinessWatcher`.
   - Success criteria: `readiness_status === "ready"` and all four probe checks pass.

2. **Debug an unhealthy Fly agent**
   - Run `flyMachineDiagnostics` for the app.
   - Inspect machine state, Fly health-check output, events (OOM, exit codes).
   - Apply the diagnosis heuristic: OOM → redeploy with 4 GB+; crash-loop → check `JAVA_TOOL_OPTIONS` and DB init; unauthorized → verify Docker Hub image tag.
   - Cross-check `agentBaseUrl()` strips `/cloud-agent` for `mode === "fly"`.

3. **Rotate admin API key on a Fly agent**
   - Call `rotateFlyAdminKey`: mint new key, update Fly machine env, restart, verify health.
   - Update stored connection row with new key.
   - Success criteria: health probe returns 200 with new key.

4. **Add a new Identus console page or flow**
   - Add types to `src/lib/identus/types.ts` if needed.
   - Implement raw logic in `src/lib/identus/*.server.ts`.
   - Expose via `createServerFn` in `src/lib/identus.functions.ts`.
   - Create route under `src/routes/app.<feature>.tsx`.
   - Import only from `*.functions.ts` / `types.ts` in the route.
   - Add nav link in `AppShell.tsx` if it belongs in the console.

5. **Use the Sprites sandbox for SDK snippets**
   - Verify `SPRITES_TOKEN` is the 4-part `org-slug/org-id/token-id/token-value` format.
   - Call `ensureSandbox` to create/retrieve a box.
   - Inject `AGENT_BASE_URL` and `AGENT_API_KEY` placeholders via snippet env.
   - Run snippet via Sprites exec endpoint; parse `0x03 <exitCode>` framing.

6. **Author or validate a Docker Compose file in the Compose Lab**
   - Use `DEFAULT_COMPOSE` in `src/lib/sprites/compose.server.ts` as the canonical Identus stack template.
   - Validate with the Python validator: checks for insecure passwords, missing healthchecks, dependency conditions.
   - Save to `compose_files` table; do not attempt to run containers inside Sprites.

## Validation before applying

- Read `src/lib/identus/fly.server.ts`, `src/lib/identus/agent.server.ts`, and `src/lib/sprites/sprites.server.ts` to confirm the latest constants and env vars.
- Read `src/routes/docs.tsx` to pull the current stack description and comparison table wording.
- Confirm the skill description is specific enough to trigger on Identus-related requests.
- Keep the skill under the 150-line target for `SKILL.md` by moving long examples into `references/`.

## Application

After the draft is complete, call `skills--apply_draft` with `.agents/skills/hyperledger-identus` to activate the skill. Then report the skill as active and summarize what it teaches.