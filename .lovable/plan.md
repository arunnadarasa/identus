# Rotate admin credentials

Adds a "Rotate admin credentials" action to Fly agent cards: it mints a fresh admin API key, updates the deployed Cloud Agent machine's configuration, waits for the machine to come back healthy, and stores the new key in the console configuration.

## What you get

- **Rotate admin credentials** button on every Fly agent card (and in the console configuration card when the active agent is a Fly deploy), behind a confirm dialog explaining the agent restarts.
- A live step list while it runs: mint key -> update machine -> wait for restart -> verify with the new key. Uses the same terminal-style log component as the deploy flow.
- On success, a one-time credentials card shows the new admin key with reveal/copy, and the console starts using it immediately for all protocol calls.
- On failure to verify, the previous key is restored in both the machine config and the console, and the error body from Fly is shown in the log, so the agent is never left with a key the console does not hold.

## Behaviour notes

- Rotation applies to `mode: 'fly'` agents only. Simulated agents have no key; for Docker-local agents the button is replaced by a short note that the key is set in your compose file, with a field to update the stored value.
- The Cloud Agent seeds its default wallet key at first boot, so after restart the verification step probes with the new key and, if the agent still answers only to the old one, the log says so explicitly and the rotation is rolled back rather than reported as successful.

## Technical notes

- `src/lib/identus/fly.server.ts`: add `getMachine(appName, machineId)` and `updateMachineEnv(appName, machineId, env)` that read the machine's current `config`, merge the new `ADMIN_TOKEN` / `DEFAULT_WALLET_AUTH_API_KEY`, and `POST /apps/{app}/machines/{id}` with the full config, then `waitForMachineState(appName, machineId, 'started')` using `GET /apps/{app}/machines/{id}/wait`. Errors keep flowing through `FlyApiError` + `describeFlyError`.
- `src/lib/identus/fly.functions.ts`: add `rotateFlyAdminKey` (auth middleware, `{ id: uuid }`) that generates `crypto.randomUUID()`-based key material, records steps into `provision_log` via the existing `runStep`/`persist` pattern so the log viewer works unchanged, calls `probeAgent` with the new key, writes `api_key`, `last_probe`, `last_health` and `readiness_status` on success, rolls back on failure, and logs `connection.key_rotated` to `activity_log`. The new key is returned once in the response and never re-listed by `listConnections`.
- `src/lib/identus.functions.ts`: add `setConnectionKey` for the Docker-local case (stores a pasted key and re-probes).
- New `src/components/RotateKeyDialog.tsx`, rendered from `src/routes/app.agents.tsx` and `src/components/ActiveAgentCard.tsx`; reuses `ProvisionLogViewer` for the step list and `revealConnectionKey` for later access to the key.
- No schema change: `agent_connections.api_key`, `provision_log`, `last_probe` already cover this.
