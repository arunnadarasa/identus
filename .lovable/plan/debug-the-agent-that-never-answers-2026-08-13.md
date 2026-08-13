# Debug the agent that never answers

## What I could confirm

- Your latest connection `identus-agent-5709` (region `lhr`) is stored with `provision_status: ready`, `readiness_status: waiting`, `last_health: unreachable`.
- All three Fly machines report `started`, and the agent machine config is correct on paper: public service 80/443 -> internal 8085, HTTP health check on `/_system/health` with a 300s grace period, 6PN-friendly JVM flags.
- Hitting `https://identus-agent-5709.fly.dev/_system/health` from outside times out with no HTTP response at all (not a 502, not a 401).

## What I could not confirm

The root cause. The console currently shows only "up/down" per probe and Fly's own check summary — neither tells us whether the container crashed during database migration, is still booting, failed to bind port 8085, or is up but unreachable through the edge. **Container logs are the missing signal**, and the app has no way to read them today. So step 1 is to get that signal, not to guess a fix.

## Plan

### 1. Agent log viewer (the actual debugging tool)

- New server function `flyMachineLogs(appName, machineId?)` that pulls recent container log lines from Fly for the app, newest last, with an optional level/keyword filter.
- New `FlyAgentLogs` panel on the Agents page, next to Machine diagnostics: terminal-style tail of the cloud-agent machine, refresh button, and a "copy log" action.
- A small classifier over the log text that names the common failures in plain language:
  - JDBC / `Connection refused` / `UnknownHost` on a `.internal` host -> Postgres or PRISM node not reachable on the private network
  - `FATAL: database "pollux" does not exist` -> Postgres init script did not create the four databases
  - `Flyway` / migration lines still streaming -> still migrating, keep waiting
  - `OutOfMemory` / `Killed` -> raise machine memory
  - `Address already in use` / no "started on port 8085" line -> the REST service never bound

### 2. Make "down" say why

Right now every failed probe collapses to `down`. Update the probe so each check records what actually happened — DNS failure, TCP timeout, TLS error, HTTP status plus a short body snippet — and show that text under each probe row. This distinguishes "Fly edge has no healthy instance" (502) from "nothing is listening" (timeout) from "agent is up but the admin key is wrong" (401).

### 3. Also probe the prefixed path

Probe `/_system/health` and, on failure, `/cloud-agent/_system/health`, and remember which one answered on the connection. Costs one extra request and rules out a whole class of false negatives for adopted or gateway-fronted agents.

### 4. Then act on the evidence

Once the logs name the failure we fix that specific thing and redeploy. `identus-agent-5709` was created before the memory/grace-period/JVM changes landed, so a clean redeploy is likely part of the fix — but I want the logs first so we do not redeploy blind a second time.

## Technical notes

- Logs come from Fly's app log endpoint (`api.fly.io`), authenticated with the existing `FLY_API_TOKEN` secret; no new secret needed. The sandbox copy of that token currently fails validation, so log fetching will run through the app's server function where the working token lives.
- Files touched: `src/lib/identus/fly.server.ts` (log fetch + classifier), `src/lib/identus/fly.functions.ts` (`flyMachineLogs` server fn), `src/lib/identus/agent.server.ts` (richer probe failure detail, fallback path), `src/routes/app.agents.tsx` (mount the panel), new `src/components/FlyAgentLogs.tsx`.
- No schema change required; probe detail fits in the existing `last_probe` JSON column.
