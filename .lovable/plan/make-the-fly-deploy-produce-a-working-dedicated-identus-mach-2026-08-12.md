# Make the Fly deploy produce a working dedicated Identus machine

The deploy flow creates the app, volume and three machines, but reading the current configuration against how Fly private networking and the Cloud Agent actually behave, a deployed app cannot come up healthy. Four concrete defects to fix, then a deploy.

## What's wrong today

1. **The agent can't find Postgres or the PRISM node.** Both hostnames are built as `identus-postgres.process.<app>.internal`. Fly's `*.process.*` DNS resolves *process groups*, not machine names, and machines created through the Machines API all land in the default group, so neither name resolves. The agent boots, fails its JDBC connection and restarts forever.
2. **Health checks hit the wrong path.** The connection's base URL is `https://<app>.fly.dev/cloud-agent`, so probes request `/cloud-agent/_system/health`. That prefix only exists in the upstream compose stack, which puts a gateway in front. Talking straight to the agent machine, the path is `/_system/health` at the app root.
3. **The PRISM node shares the agent's database.** Node and agent both point at the `agent` database with schema `public`, so their migrations collide. Upstream gives the node its own database.
4. **Postgres is published to the public internet** via a `services` block on port 5432 on the shared app. Internal machine-to-machine traffic needs no service definition at all.

## The fix

- Tag each machine with a process group in its metadata (`postgres`, `prism-node`, `agent`) so the existing `<group>.process.<app>.internal` names resolve; additionally capture the private IPv6 returned by the create call and prefer it for the agent's env, so the agent works even if DNS lags.
- Drop the `services` block from the Postgres machine and add `NODE_PSQL_DATABASE: node` plus a `node` database in the Postgres init script.
- Store the connection base URL as `https://<app>.fly.dev` and keep the probe paths (`/_system/health`, `/did-registrar/dids`, …) relative to it. Existing Fly connections that already carry the `/cloud-agent` suffix get normalised when they are probed.
- Add a "Wait for Postgres" step between volume creation and the PRISM node so the log shows the database coming up rather than the agent silently restarting.
- Keep the agent machine sized as configured (default 2 CPU / 2 GB), which is what the JVM agent needs.

## Then deploy

Run a real deployment through the Fly.io tab with a dedicated app name, watch the provisioning log, and let the readiness watcher poll until the agent answers `/_system/health`. If the machine reports healthy, activate it as the console's agent. The suspended `quantum-service` / `quantumbrush` apps in the organisation are unrelated and stay untouched.

## Technical notes

Files: `src/lib/identus/fly.server.ts` (machine configs, metadata, init script, env), `src/lib/identus/fly.functions.ts` (provisioning steps, stored base URL), `src/lib/identus/agent.server.ts` (base-URL normalisation in `probeAgent`).
