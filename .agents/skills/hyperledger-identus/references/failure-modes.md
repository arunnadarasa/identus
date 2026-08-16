# Failure modes and diagnosis heuristics

## `diagnose()` heuristic (fly.server.ts)

`getMachineDiagnostics` retrieves machine state, Fly health-check results, and events. `diagnose()` applies these rules in order:

- **OOM kill** (`event.oomKilled === true` or events contain `oom_killed`): "Redeploy with more memory — 4 GB or more." The JVM heap + four DB migrations exceed 2 GB.
- **Crash loop** (repeated non-zero `exitCode`): inspect `JAVA_TOOL_OPTIONS` (IPv6 flags must be set) and whether the Postgres init script ran (the four databases must exist). If migrations fail, the agent restarts forever.
- **Registry/auth failure** (`describeFlyError` matches `failed to get manifest` or `unauthorized`): the image tag is not publicly pullable. Use Docker Hub `identus/...` tags with explicit versions.
- **Health check failing**: read `checks[].output` — Fly's health-check output usually carries the real error text (e.g. connection refused, 503).

## Common failures and fixes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `0/4 down` on probe | Agent not reachable or not booted | Check `flyMachineDiagnostics` state; if `starting`, wait for readiness. If `stopped`/crash-loop, see below. |
| OOM-killed on first boot | 2 GB too small for four migrations | Redeploy with 4 GB+ (`agentMachineConfig` guest `memoryMb: 4096`). |
| JDBC/gRPC connection refused | JVM preferring IPv4 on 6PN | Set `JAVA_TOOL_OPTIONS` with `-Djava.net.preferIPv6Addresses=true -Djava.net.preferIPv4Stack=false`. |
| Fly restarts agent mid-migration | Grace period too short | `grace_period: 300s` in the health check config. |
| `failed to get manifest ... unauthorized` | GHCR image not anonymous | Use `docker.io/identus/...` pinned tags. |
| Schema migration collision | Single shared database | Postgres init creates `pollux`, `connect`, `agent`, `node`; agent config points each component at its own. |
| Console can't reach healthy agent | Stored URL keeps `/cloud-agent` for fly mode | `agentBaseUrl()` strips it for `mode === "fly"`. Verify the stored `base_url`. |
| 401/403 on non-system probe checks | API key rejected | Re-run `rotateFlyAdminKey` or re-enter the key; verify `ADMIN_TOKEN` matches the stored key. |
| Postgres init script didn't run | pgdata volume already existed | `docker compose down -v` (local) or destroy and redeploy the Fly app so the volume is fresh. |
| Port bind already in use (docker) | Another process holds the host port | Change the host side in `.env` (e.g. `POSTGRES_PORT=5433`). |
| `<app>.fly.dev` does not resolve at all (probes fail with a transport error, not 502) | App has no public IP; Fly only publishes DNS once one is allocated | `listIpAddresses(app)` returns empty -> run `flyAllocateIps` / `allocateSharedIpv4`, which now verifies the allocation instead of trusting the mutation. A deploy-scoped token cannot allocate IPs; use an organisation token. |
| `no matching manifest for linux/arm64` | Image has no arm64 build | Add `platform: linux/amd64` to that service (emulation is slower). |
| Invitations decode to a placeholder or port-less host; remote wallets never connect | `DIDCOMM_SERVICE_URL` wrong and/or internal port 8090 not published on the cloud-agent machine | Run `repairAgentEndpoints(app)` ("Repair DIDComm endpoint"): adds the 8090 `http`+`tls` service, sets `DIDCOMM_SERVICE_URL=https://<app>.fly.dev:8090`, restarts. No redeploy needed. |
| Sandbox snippet dies with `TypeError: Invalid URL` | `AGENT_BASE_URL` is empty because the console is in simulated mode, and `"" + "/path"` is not a URL | Keep `REST_PRELUDE` at the top of every REST snippet — it exits with a plain message saying a real (docker/fly) agent is required. |
| x402 / delegation gate rejects with "credential mismatch" although both credentials are valid | The human principal (credential subject) was compared against the agent DID (mandate subject) | Compare principal↔credential subject and agent↔mandate subject separately; the mandate links the two, they are never equal. |
| ZK panel appears frozen with no error | WASM/module download stalled with no per-phase timeout | Track phase + bytes, apply a per-phase timeout, and surface a retry button (`zk-proof-client-entry.tsx` distinguishes `load-timeout` / `prove-timeout`). |

## Readiness vs health

`checkHealth` hits only `/_system/health`. `probeAgent` hits four endpoints and is the real readiness signal — an agent can pass system health but fail DID registrar while migrations are still running. Use `awaitAgentReady` (which calls `probeAgent`) before declaring an agent usable.

## Container logs

The Machines API has no logs endpoint. `getAgentLogs(app, machineId?)` reads `https://api.fly.io/api/v1/apps/<app>/logs` (JSON:API, `data[].attributes.message`) and `classifyLogs` maps the tail to a plain-language cause (OOM, missing database, DNS on `.internal`, connection refused, still migrating, port bind). Surface it with `FlyAgentLogs` on the Agents page.
