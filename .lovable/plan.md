# Debug: identus-agent-arun never answers

## What I verified just now

- The console row for `identus-agent-arun` is `readiness_status: waiting`, `last_health: unreachable`, 3 attempts, and every probe check times out at 6s.
- Public networking is fine: the app has both a public IPv4 (`66.241.124.86`) and IPv6 address, and DNS resolves. So this is not the "missing public IP" failure from the previous deploy.
- Requests to `https://identus-agent-arun.fly.dev/_system/health` hang until timeout instead of returning an error. Fly's edge accepts the connection but the agent machine is not answering on port 8085 — it is either still migrating databases or crash-looping.
- The Fly machine config requests 2 shared CPUs / 2048 MB for the agent (`agentMachineConfig` default and the "recommended" size in the deploy panel). Identus first boot migrates four databases on the JVM; 2 GB is the size that previously got OOM-killed, and 4 GB is the value recorded as safe.

The screenshot at 2m13s is also inside the normal boot window, so part of what you are seeing is the UI presenting a still-booting agent as four red "down" rows with no explanation.

## Step 1 — confirm the cause from the machine itself

Before changing anything, read the evidence the app can already fetch for this connection:

- Machine diagnostics: per-machine state, restart count, memory, and Fly health-check output.
- Agent logs: the container boot tail, which shows either Flyway migrations in progress, a JDBC/gRPC connection failure, or an OOM kill.

Whichever of the three signals appears decides the fix: OOM/restarts -> memory, JDBC/gRPC errors -> Postgres or PRISM node reachability, quiet-but-slow migrations -> patience plus a longer readiness deadline.

## Step 2 — remove the known undersizing

- Raise the agent machine default to 4 shared CPUs / 4096 MB, and make 4 GB the "recommended" option in the deploy panel (keep 2 GB as an explicitly-labelled cheap option that may OOM on first boot).
- Existing unhealthy Fly agents get a "Resize agent machine" repair action in Machine diagnostics that applies the 4 GB guest and restarts that machine, so `identus-agent-arun` can be fixed without a full redeploy.

## Step 3 — make booting readable

- While readiness is still inside the boot window, show "Still booting — first boot migrates four databases and usually takes 3–6 minutes" instead of four bare red rows, and only switch to a failure presentation once the deadline passes.
- Extend the readiness watcher deadline to 12 minutes so a healthy-but-slow first boot is not reported as a failure.
- When the deadline does pass, surface the single most likely cause from the machine events (OOM, restart loop, DB unreachable) directly in the card, with the diagnostics and logs panels one tap away.

## Technical notes

- `src/lib/identus/fly.server.ts`: `agentMachineConfig` guest default 2048 -> 4096 / cpus 4; add a `resizeAgentMachine` helper that PATCHes the machine config guest and restarts it.
- `src/lib/identus/fly.functions.ts`: expose `flyResizeAgent` (auth middleware, verifies the connection belongs to the caller) and log the step into `provision_log`.
- `src/components/FlyDeployPanel.tsx`: reorder/relabel `SIZES` so 4 GB is recommended.
- `src/components/AgentReadinessWatcher.tsx`: raise the deadline, add a `booting` presentation for the pre-deadline window.
- `src/components/FlyMachineDiagnostics.tsx`: add the resize repair button next to the existing IP repair action.
- Update the Identus skill's failure-modes card with "hangs with no response, machine started, 2 GB guest -> undersized agent".

No database schema change is needed.
