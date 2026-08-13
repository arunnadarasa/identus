# Debug: identus-agent-arun never answers

## What the evidence says

- Console row for `identus-agent-arun`: `readiness_status: waiting`, `last_health: unreachable`, every probe times out at 6s.
- Public networking is fine — the app has a public IPv4 (`66.241.124.86`) and IPv6 address and DNS resolves. This is not the earlier "missing public IP" failure.
- Requests to `https://identus-agent-arun.fly.dev/_system/health` hang until timeout: Fly's edge accepts the connection but nothing behind it answers on port 8085.
- The Fly logs you shared contain **only `io.iohk.atala.prism.node` lines** — the PRISM node happily looping over "move scheduled objects to pending". There is not a single Cloud Agent log line, and the machine list shows one machine **STOPPED** next to one **STARTED**.

So the PRISM node is healthy and the Cloud Agent machine is not running. That is why the URL hangs. The most likely reason at the configured size is that the agent machine exited during first boot (OOM or a failed DB migration) — the agent is currently created with only 2 shared CPUs / 2048 MB, which is the size previously recorded as too small for the four first-boot database migrations.

## Step 1 — name the exit reason

Extend the diagnostics that already exist for this connection so the agent machine's own story is visible without leaving the app:

- Show each machine's state, restart count, memory, last exit code, and `oomKilled` flag, with the stopped machine pulled to the top.
- Filter the log tail per machine so the Cloud Agent's (empty or truncated) output is distinguishable from the PRISM node's noise, and say explicitly when the agent produced no logs at all — that itself is the finding.
- Translate the machine event into one sentence: OOM-killed, exited non-zero during migration, or stopped cleanly.

## Step 2 — fix the sizing and restart the agent

- Raise the agent machine default to 4 shared CPUs / 4096 MB and make 4 GB the "recommended" choice in the deploy panel; keep 2 GB as an explicitly-labelled cheap option that may fail on first boot.
- Add a **Repair agent machine** action to Machine diagnostics that applies the 4 GB guest to the existing machine and starts it again, then re-runs the readiness watcher. This fixes `identus-agent-arun` in place — no redeploy, no new app.
- Make provisioning treat a stopped/exited agent machine as a failed step with the exit reason in the provisioning log, instead of reporting "Start Identus Cloud Agent ✓" and moving on.

## Step 3 — make the wait honest

- Before the deadline, show "Still booting — first boot migrates four databases and usually takes 3–6 minutes" instead of four bare red rows.
- Raise the readiness deadline to 12 minutes.
- When readiness fails, show the machine-level reason (agent machine stopped, OOM, DB unreachable) directly on the card with the repair action next to it.

## Technical notes

- `src/lib/identus/fly.server.ts`: `agentMachineConfig` guest 2048 -> 4096 / cpus 4; add `resizeAndStartAgentMachine` (PATCH machine config guest, then `POST /machines/:id/start`); after starting the agent during provisioning, assert the machine reaches `started` and stays there, and capture `exit_code`/`oom_killed` into the step detail.
- `src/lib/identus/fly.functions.ts`: expose `flyRepairAgentMachine` behind the auth middleware, verify connection ownership, append the repair to `provision_log`, then re-arm readiness.
- `src/components/FlyMachineDiagnostics.tsx`: stopped-machine-first ordering, exit code / OOM row, Repair agent machine button alongside the existing IP repair.
- `src/components/FlyAgentLogs.tsx`: per-machine filter plus an explicit "Cloud Agent produced no output" state.
- `src/components/FlyDeployPanel.tsx`: reorder/relabel `SIZES` so 4 GB is recommended.
- `src/components/AgentReadinessWatcher.tsx`: 12-minute deadline, `booting` presentation before it.
- Skill update: add "hangs, only prism-node logs, agent machine STOPPED -> undersized/exited agent machine" to the failure-modes card.

No database schema change is needed.
