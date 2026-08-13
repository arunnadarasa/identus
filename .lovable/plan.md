# The Postgres version is too new for the Cloud Agent

Good news: the application roles fix worked. The agent now gets past connecting and past the earlier `pollux-application-user` failure, and runs its Flyway migrations. It dies later, on a different line:

```text
Migration V27__presentation_definition_table.sql failed
SQL State : 42601
Message   : ERROR: syntax error at or near "format"
Statement : CREATE TABLE public.presentation_definition ( ... format json, ... )
```

That is Postgres rejecting the migration's own SQL, not a permissions or networking problem. The agent's machine then stops (`843ed5f2de64d8` = STOPPED) while the PRISM node keeps happily running, which is exactly the pattern in your screenshots.

## Root cause

The deploy runs `postgres:16-alpine`. Postgres 16 added the SQL/JSON `FORMAT JSON` clause, which makes a bare `format json` column definition ambiguous to the parser — so Identus 1.40's V27 migration, written against the version upstream ships, is a syntax error on 16. Upstream's Identus compose stack pins an older Postgres, which is why the same migration works there.

## Fix

1. Pin the Fly Postgres machine to `postgres:13-alpine`, matching what Identus 1.40 is tested against, and keep the version in one named constant so it is easy to bump when Identus supports newer Postgres.
2. Pin the same version in the Compose Lab template so the docker-local instructions and the hosted deploy agree.
3. Add a diagnosis rule for `syntax error at or near "format"` / `V27__presentation_definition_table.sql failed` that reads "Postgres is too new for this Cloud Agent version — redeploy with Postgres 13" instead of a generic boot failure.
4. Note the version requirement in the docs page next to the Docker guide.
5. Because the databases and roles are already initialised on the existing volume and the data directory would be incompatible across major versions anyway, `identus-agent-81ed` cannot be upgraded in place — deploy a fresh app name and destroy the old ones once the new agent reports healthy.

## Technical notes

- `src/lib/identus/fly.server.ts`: change `POSTGRES_IMAGE` to `postgres:13-alpine`; add the new signature to the `LOG_RULES` diagnosis table.
- `src/lib/sprites/compose.server.ts`: same `POSTGRES_IMAGE` change so `DEFAULT_COMPOSE` matches.
- `src/routes/docs.tsx`: one line on the supported Postgres version.
- No schema or UI changes; the readiness watcher, diagnostics and log viewer work unchanged.
