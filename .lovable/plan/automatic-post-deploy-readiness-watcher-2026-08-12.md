# Automatic post-deploy readiness watcher

## Current behaviour

After a Fly deploy succeeds, the panel shows "booting…" and pings the shallow health endpoint every 10s, up to 12 attempts (~2 minutes). Weaknesses:

- It gives up silently — no "still booting" or "timed out" message, no retry.
- It only checks basic reachability, not whether the DID registrar / issuance / DIDComm endpoints actually answer, so "healthy" can appear before the agent is usable.
- The watcher lives entirely in component state: leaving the Agents page or reloading stops it, and the agent card still reads unreachable until you check manually.
- No visible sense of elapsed time or expected wait.

## Plan

1. Readiness state on the agent record
   - Add a readiness field on each agent connection (status + attempt count + first-seen-ready timestamp) so "waiting for the agent to become ready" survives reloads and is visible on the agent card and Overview, not just inside the deploy panel.
   - Provisioning marks a freshly deployed Fly agent as "waiting for readiness" automatically.

2. Server-side readiness check
   - New readiness server function that runs the existing deep probe (system health, DID registrar, issuance, DIDComm), decides ready vs not-ready, records the result and attempt count on the connection, and logs a single readiness entry to the activity trail on transition (not on every poll, to avoid flooding).
   - Ready means the system health check passes and the DID registrar responds; the remaining checks are reported but do not block readiness.

3. Automatic polling until ready
   - The deploy panel starts polling as soon as provisioning succeeds — no user action.
   - Backoff schedule: every 5s for the first minute, then every 15s up to a 10-minute ceiling (Postgres + PRISM node + agent boot can exceed 2 minutes).
   - Any agent in "waiting" state resumes polling automatically when the Agents page loads, so a reload or navigation does not orphan a booting deploy.

4. UI feedback
   - Live status line: "Waiting for the agent… (attempt N, 1m 20s elapsed)" with a spinner, then a green "Agent ready" with total boot time.
   - Per-check breakdown from the latest probe, so a partially-up agent is visible rather than just "not ready".
   - On timeout: a clear message with the last failure reason, a "Check again" button, plus the existing destroy/clean-up action.
   - "Use this agent" is enabled the moment readiness is confirmed.

## Technical notes

- Migration: add readiness columns to `agent_connections` (e.g. `readiness_status`, `readiness_attempts`, `ready_at`), no new table.
- New `awaitAgentReady` server function in `src/lib/identus.functions.ts` reusing `probeAgent` from `src/lib/identus/agent.server.ts`; polling loop stays client-side (no long-running server work).
- `src/components/FlyDeployPanel.tsx`: replace the fixed 12x10s loop with the backoff watcher and richer status UI.
- `src/routes/app.agents.tsx` / `src/routes/app.index.tsx`: show waiting/ready state and auto-resume polling for any connection still in `waiting`.
- Simulated agents are always ready; the watcher never runs for them.
