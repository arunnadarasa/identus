# Debug: "Already taken" warning on the app you just deployed

## What the data shows

Your deploy of `identus-agent-81ed` did work — the stored provisioning log has seven steps, all ok: app created, volume, Postgres machine, Postgres accepting connections, PRISM node, Cloud Agent machine, and "Verify agent machine is running: running". So the amber note "An app named identus-agent-81ed already exists… adopt it instead" and the red "Already taken in your Fly organisation" under the field are both wrong: the app exists because *this* deploy created it moments earlier.

Two separate defects, both confirmed:

1. **The name availability check does not know about the deploy in progress.** It re-runs while the deploy is running (and after it finishes), asks Fly whether the name exists, gets "yes", and renders the collision error, the amber adopt note, and re-labels the button to "Choose a free app name". It also blocks Retry.

2. **Deploys never reach a final state.** Both `identus-agent-81ed` and `identus-agent-9b64` are still stored as `provision_status: provisioning` with `readiness_status: unknown`, even though 81ed logged every step. The panel therefore sits on "Deploying…", the readiness watcher never starts, and the Fly app drifts to suspended with nothing watching it. 9b64 is stranded even earlier, at "Wait for Postgres to start".

## Fixes

### 1. Stop the collision UI from firing on your own app

- Record the name this session has started deploying. Once a deploy begins for a name, the availability check for that exact name is ignored — no red field error, no amber adopt note, no "Choose a free app name" label.
- Suppress the collision UI entirely while `phase` is `deploying` or `done`; it is only meaningful before a deploy starts.
- The amber "adopt it instead" note only shows for a name the user typed that was already taken before deploying, or after a real 422 `name_taken` failure.

### 2. Always land the deploy on a final status

- Wrap the provisioning sequence so that any exit path — success, thrown error, or an aborted request — writes a terminal `provision_status` (`ready` / `failed`) rather than leaving `provisioning`.
- Treat a row that has been `provisioning` with no new step for several minutes as stalled: the log viewer labels it "stalled — no progress since <time>" and offers **Resume readiness check** (start the watcher against the existing machines) and **Destroy app**.
- On page load, any `fly` connection still marked `provisioning` gets that same stalled treatment instead of an eternal spinner.

### 3. Recover the two stranded apps from the console

- `identus-agent-81ed` has all three machines and the new Postgres role fix, so resume its readiness check and, if the agent answers, mark it ready and activate it.
- `identus-agent-9b64` never got past Postgres; offer destroy so it stops occupying a name and a volume.

## Technical notes

- `src/components/FlyDeployPanel.tsx` — add `deployingName` state; gate `nameTaken` on `debouncedName !== deployingName && phase === "idle"`; keep the Deploy button's disabled logic but drop `nameTaken` from it once a deploy for that name is under way.
- `src/lib/identus/fly.functions.ts` — `provisionFlyAgent`: `try/catch/finally` around the machine sequence so the `agent_connections` row always ends at `ready` or `failed` with a message; add a `resumeFlyProvisioning` server fn that re-probes machines for an existing row and finalises its status.
- `src/components/ProvisionLogViewer.tsx` — stalled banner driven by the newest step's `at` timestamp versus now, plus the two recovery actions.
- No schema change; `provision_status`, `provision_log` and the readiness columns already carry everything needed.
