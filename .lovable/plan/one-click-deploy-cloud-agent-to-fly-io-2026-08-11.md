# One-click "Deploy Cloud Agent to Fly.io"

Most of the machinery already exists (the Fly tab on the Agents page provisions
Postgres + PRISM node + Cloud Agent using the saved `FLY_API_TOKEN`). What is
missing is the one-click experience, admin credential control, and visible
progress. This plan closes those gaps.

## What changes

### 1. A single deploy panel with sensible defaults
- Replace the current Fly form with a "Deploy Cloud Agent" panel that pre-fills
  everything: a suggested app name (e.g. `identus-agent-4f2a`), the first
  organisation from your Fly account, and a default region.
- If only one organisation exists, it is selected silently — the panel then only
  needs one click.
- Advanced settings (app name, organisation, region, machine sizes) collapse into
  an "Advanced" section so the default path is a single button.

### 2. Admin credentials you control
- Add an "Admin credentials" field pair in Advanced: admin API key and Postgres
  password. Both default to freshly generated strong values, with a "Regenerate"
  action; you can paste your own instead.
- After a successful deploy, show a credentials card with the agent URL, admin
  API key and copy buttons, plus a one-time warning that the key is what the
  console uses to talk to the agent.
- The key continues to be stored on the connection row server-side and is never
  logged.

### 3. Live deploy progress
- Stream the provisioning steps into the panel as they happen (create app →
  volume → Postgres → PRISM node → Cloud Agent → public IPs), each with a
  tick/cross, instead of only appearing after the whole run finishes.
- On failure, the failing step and its message are shown inline with a "Retry"
  button and a "Clean up app" action that destroys the half-created Fly app.

### 4. Post-deploy readiness
- After deploy, poll the agent health endpoint for a couple of minutes and show
  "Booting…" → "Healthy", then offer "Use this agent" to make it the active
  connection in one click.
- Pre-flight validation before any Fly call: token usable, app name available,
  name format valid — so failures surface before half a stack exists.

## Technical notes

- `provisionFlyAgent` gains optional `adminKey`, `pgPassword`, `cpus` and
  `memoryMb` inputs (validated, with generated defaults when omitted) and writes
  each step to `agent_connections.provision_log` as it goes — already the case,
  so the UI polls that row for live progress via the existing connections query
  on a short interval while status is `provisioning`.
- New server fn `flyPreflight` (token check + `GET /apps/{name}` availability +
  suggested name) so the button can be enabled/disabled with real information.
- `src/routes/app.agents.tsx`: Fly tab rewritten into a `FlyDeployPanel`
  component with defaults, Advanced disclosure, credentials reveal, live step
  list, retry and cleanup.
- Machine sizes stay in `fly.server.ts` config builders, parameterised by the new
  guest inputs.
- No schema change needed: `fly_app_name`, `fly_region`, `api_key`,
  `provision_status` and `provision_log` already exist.
