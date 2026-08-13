# Yes — the logs name the exact failure

The agent is not OOM-killed and its networking is fine. It reaches Postgres (`DBPool - Start completed`, a real JDBC connection), then dies during the first-boot migration on:

```text
ERROR: role "pollux-application-user" does not exist
  at org.hyperledger.identus.pollux.sql.repository.Migrations$
```

That is why `/_system/health` never answers and Fly logs `instance refused connection… is your app listening on 0.0.0.0:8085?` — nothing ever bound the port because startup aborted.

## Root cause

The Cloud Agent runs its schema migrations as the admin user, but each migration ends with `GRANT`s to a separate, less-privileged application role — `pollux-application-user`, `connect-application-user`, `agent-application-user`. Upstream's compose stack creates those roles in its Postgres init script and passes them to the agent. Our Fly deploy creates only the four databases (`pollux`, `connect`, `agent`, `node`) and points every component at `postgres`, so the `GRANT` has no role to grant to and migration fails on the very first database.

## Fix

1. Extend the Postgres init script to create the three application roles with a generated password, and grant each `CONNECT` on its database plus usage on the `public` schema.
2. Pass the app-user credentials to the agent (`POLLUX_DB_APP_USER` / `POLLUX_DB_APP_PASSWORD` and the `CONNECT_*` / `AGENT_*` equivalents), keeping `postgres` as the migration/admin user.
3. Add the missing-role signature to the diagnosis table so this shows as "Postgres is missing the Identus application roles" instead of a generic boot failure.
4. Because the init script only runs on an empty data directory, `identus-agent-97dd` cannot be repaired in place — deploy a fresh app (new name, fresh volume) and destroy the old one once the new agent reports healthy.

## Technical notes

- `src/lib/identus/fly.server.ts`: `postgresMachineConfig` init script gains role creation and grants; it needs the app-role password, so both machine builders take it as an argument. `agentMachineConfig` gains the `*_DB_APP_USER` / `*_DB_APP_PASSWORD` env pairs. New entry in the diagnosis `test` list for `role "…-application-user" does not exist`.
- `src/lib/identus/fly.functions.ts`: `provisionFlyAgent` generates the app-role password alongside `pgPassword` and threads it into both configs.
- No schema or UI change; the readiness watcher and diagnostics panel work unchanged.
