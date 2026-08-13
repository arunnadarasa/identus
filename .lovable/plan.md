# Remove the ghost Fly agents and stop them coming back

## What's actually going on

Your console lists two Fly agents that no longer exist on Fly:

- `Fly · identus-agent-5ce1` — marked active, health "unreachable"
- `Fly · identus-agent-5fe0` — stuck at "provisioning"

Your Fly dashboard shows only `krumpklaw`, `quantumbrush`, `quantum-service` — so both Identus apps are gone (or were never fully created). The console keeps showing them because the rows in your account's data are still there, and the "Destroy" button tries to delete the Fly app first, which fails when the app doesn't exist, so the row never gets removed. That's the UX issue.

## Plan

1. Manually delete the two stale agent rows from your account data, and make the simulated agent active again so the console has a working agent selected.
2. Make "Destroy" resilient: if Fly replies that the app doesn't exist (404 / not found), still remove the console row and report "app already gone — removed from console" instead of throwing.
3. Add a plain "Remove from console" action on Fly agent cards, so any orphaned entry can always be cleared without touching Fly.
4. Label a Fly agent whose app is missing from Fly as "not on Fly" in the card, rather than just "unreachable", so the state is unambiguous.

## Technical notes

- Data cleanup: delete the two `agent_connections` rows (`identus-agent-5ce1`, `identus-agent-5fe0`) and set the simulated row `is_active = true`.
- `destroyFlyApp` in `src/lib/identus/fly.functions.ts`: wrap the `fly('/apps/<name>', { method: 'DELETE' })` call in a try/catch that treats not-found responses as success, then always delete the row.
- New `forgetConnection` server function (row delete only, no Fly call), wired into the Fly branch of the card actions in `src/routes/app.agents.tsx`.
- Missing-app labelling reuses the existing app-existence check already used by the diagnostics panel; no schema change needed.
