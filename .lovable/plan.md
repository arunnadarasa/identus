# Agent health checks before switching modes

Today each agent card has a "Test" button that pings `/_system/health` and stores `healthy`/`unreachable`. That is a single shallow ping with no detail, no latency, no history, and nothing stops you switching to a docker/fly agent that is not actually working. This adds a proper diagnostic probe plus a UI that surfaces it.

## What you get

- **Diagnostics probe** per agent: system health, DID registrar reachability, credential-issuance endpoint reachability, and API-key acceptance (401 vs 200), each with pass/fail, HTTP status and latency in ms.
- **Health panel** on the Agents page: expand any agent card to see the per-check list, agent version, total round-trip time and the time of the last check.
- **Guarded switching**: "Use" on a docker/fly agent runs a probe first. If checks fail you get a dialog naming the failing check with options to re-run, switch anyway, or cancel. Simulated agents switch instantly as now.
- **Auto-probe while booting**: a freshly deployed Fly agent is polled until healthy, with a booting → healthy → unreachable badge, reusing the existing deploy-panel behaviour.
- **Overview card** shows the active agent's last probe summary and a "Re-check" action.
- Every probe is written to the activity trail so failures are auditable.

## Technical notes

- `src/lib/identus/agent.server.ts`: add `probeAgent(conn)` returning `{ healthy, version, totalMs, checks: [{ id, label, ok, status, ms, detail }] }`. Each check is a bounded `fetch` (5s timeout) against the agent base URL with the stored `apikey`; unreachable base URL short-circuits with a clear message. Simulated mode returns a synthetic all-pass result. `checkHealth` stays as the cheap ping used internally by Fly provisioning.
- `src/lib/identus.functions.ts`: new authenticated `diagnoseConnection` server function (owner-scoped row lookup via `context.supabase`), persisting `last_health`, `last_checked_at` and the full probe result, and logging to `activity_log` via `logActivity`.
- Migration: add `last_probe jsonb` to `public.agent_connections` (nullable, no new grants/policies needed — existing owner policies cover it).
- New `src/components/AgentHealthPanel.tsx` renders the check list from `diagnoseConnection`; `src/routes/app.agents.tsx` embeds it per card and wraps the "Use" action in the confirm-on-failure flow. `src/routes/app.index.tsx` gains the active-agent probe summary.
- `src/lib/identus/types.ts`: add `ProbeCheck` / `ProbeResult` types and `last_probe` on `AgentConnection`.
- No raw public HTTP route: the probe must run authenticated as the owner, so it stays a server function rather than an `/api/public/*` endpoint.
