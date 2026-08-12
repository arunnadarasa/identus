# Fix the unhealthy Fly agent

No LLM/AI key is needed anywhere in this app — Identus is DID/VC infrastructure only. This plan is purely about making a deployed Fly agent actually answer.

## What the screenshots tell us

All seven provisioning steps succeeded and all three machines report `started`, yet every probe (system health, DID registrar, credential issuance, DIDComm) is `down` after 6m40s. So the problem is *after* machine creation: the Cloud Agent process inside the machine is either crash-looping, still migrating, or unable to reach Postgres / PRISM node. Right now the console has no way to see that, so we're guessing — step one is making the failure visible.

## Step 1 — Show what the machine is actually doing

Add a "Machine diagnostics" panel to each Fly agent card that pulls, per machine:

- current state plus Fly's own health-check results (Fly stores the check output text — that usually contains the real error)
- the machine event history: exit codes, restart counts, OOM kills
- the running process list
- image, region, and assigned private IP

A crash-looping agent shows up immediately as repeated `exited` events with a non-zero exit code; an out-of-memory agent shows `oom_killed`. This panel is worth having permanently, not just for this bug.

## Step 2 — Fix the failure causes we can already see in the config

Three things in the current machine config are known to break exactly this way:

1. **JVM on an IPv6-only private network.** Postgres and PRISM node are reached over Fly's private network, which is IPv6-only, and the agent is a JVM app that prefers IPv4 by default. Add the JVM flag that enables IPv6 address preference to both the agent and PRISM node so JDBC and gRPC can dial those hosts at all.
2. **Memory.** The Cloud Agent is a JVM service that runs schema migrations for four databases on first boot; 2 GB is marginal and gets OOM-killed. Raise the default to 4 GB (still selectable in the deploy form) and use 1 GB for PRISM node.
3. **Health-check grace period.** First boot legitimately takes several minutes. Extend the Fly check grace period so Fly does not restart the agent mid-migration — a restart loop during migration never converges.

## Step 3 — Make the readiness watcher honest

The watcher currently spins indefinitely with no explanation. Change it to:

- report which machine state and which Fly check it last saw, not just "attempt 3"
- stop and show a clear diagnosis when the machine is crash-looping or OOM-killed, instead of polling forever
- surface a "the agent is still migrating its databases, this can take several minutes on first boot" note while the machine is up but HTTP is not answering yet

## Step 4 — Redeploy and verify

Deploy a fresh app with the corrected config, watch the diagnostics panel through boot, and confirm all four probes go green. If the agent still fails, the diagnostics panel from step 1 will name the cause and we fix that specific error.

Also add a "Destroy leftovers" affordance so half-created apps from failed attempts don't accumulate.

## Technical notes

- `src/lib/identus/fly.server.ts`: add `getMachineDiagnostics` (machine JSON `checks` + `events`, plus the machine process-list endpoint); add `JAVA_TOOL_OPTIONS` with IPv6 preference to `agentMachineConfig` and `prismNodeMachineConfig`; raise the agent guest default and the check `grace_period`.
- `src/lib/identus/fly.functions.ts`: new `machineDiagnostics` server function (auth-gated, ownership-checked against the caller's connections); default guest memory 4096.
- New `src/components/FlyMachineDiagnostics.tsx`, rendered inside `ActiveAgentCard` / `FlyAgentPicker` next to the provisioning log.
- `src/components/AgentReadinessWatcher.tsx`: consume the diagnostics to stop on fatal states and to label the migration phase.
- No schema changes, no AI/LLM dependency.
