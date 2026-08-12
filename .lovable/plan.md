# One-click "Use this agent" for Fly agents

Today the Agents page can activate a connection the app itself created, but there is no way to point the console at a Fly app that already exists in your Fly organisation, and the admin key of an active agent is not visible anywhere after the deploy panel closes. This adds both.

## What you get

1. **Fly.io tab → "Your Fly apps"**
   - Lists apps in the selected Fly organisation with their machine state.
   - Each row has one button: **Use this agent**. Pressing it saves `https://<app>.fly.dev/cloud-agent` plus an admin key as a connection, probes it, and makes it the active agent for the console — no forms.
   - If the app is already tracked in the console, the button just re-syncs the URL/key and activates it instead of creating a duplicate.
   - Apps whose admin key the console does not know show a small inline field to paste the key once; everything else is filled in automatically.

2. **Active agent configuration card (Agents page)**
   - Shows the current agent's mode, base URL, health and admin key (masked, reveal + copy buttons).
   - "Re-check" runs the existing health probe.

3. **Existing "Use" buttons keep working** — they now go through the same save-and-activate path, so URL and key are always written to the console configuration before switching.

## Technical notes

- `src/lib/identus/fly.functions.ts`: add `listFlyApps` (Fly Machines API `GET /apps?org_slug=` plus per-app machine states) and `adoptFlyAgent` (upsert on `agent_connections.fly_app_name` for the user: writes `base_url`, `api_key`, `mode: 'fly'`, `fly_region`, `provision_status: 'adopted'`, then reuses `setActiveConnection` logic and `probeAgent`, logging `connection.adopted` to `activity_log`).
- Admin keys stay server-side: `listFlyApps` returns only whether a key is stored, never the key. Revealing the active agent's key uses a dedicated authenticated server fn scoped to `context.userId`.
- New component `src/components/FlyAgentPicker.tsx` rendered in the Fly tab of `src/routes/app.agents.tsx`; new `src/components/ActiveAgentCard.tsx` above the connection list.
- Readiness watcher is reused, so an adopted app that is still booting shows the same polling status.
- No schema change needed; `agent_connections` already has `base_url`, `api_key`, `fly_app_name`, `fly_region`.
