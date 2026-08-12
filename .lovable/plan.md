# Improve the Docker documentation

Today the docs page covers Docker in three lines (a `git clone` plus `./run.sh`) and the Compose comparison table. The Compose Lab already ships a full pinned Identus stack, but nothing in the docs explains how to actually run, inspect, or fix it. This plan turns Docker into a first-class section, written against current Docker Compose guidance.

## What gets added to the docs page

A new "Run Identus with Docker" section, replacing the thin "Docker on your machine" block:

1. **Prerequisites** — Docker Desktop / Engine with the Compose v2 plugin, `docker compose version` check, and a note on resource headroom (the agent is a JVM service; 4 GB+ recommended).
2. **Two routes to a local stack**
   - Upstream: clone `hyperledger-identus/cloud-agent` and use its local infrastructure scripts.
   - Compose Lab: generate a validated, pinned bundle from the Sandbox and run it in any folder. Explain that the Lab writes `docker-compose.yml`, `.env` and `postgres/init.sql`.
3. **Lifecycle commands** with what each one is for: `docker compose up -d --wait`, `docker compose ps`, `docker compose logs -f cloud-agent`, `docker compose restart <service>`, `docker compose down` vs `docker compose down -v` (and the warning that `-v` deletes the wallet/Postgres data).
4. **How the stack fits together** — a short ASCII diagram of `postgres` → `prism-node` → `cloud-agent`, the four databases (`pollux`, `connect`, `agent`, `node`), and the two agent ports (REST 8085, DIDComm 8090).
5. **Environment and ports** — table of the `.env` variables, which host ports they map to, how to change them when something is already bound, and that `ADMIN_TOKEN` is what the console stores as the admin API key.
6. **Health, dependencies, and startup order** — why `depends_on` uses `condition: service_healthy` for Postgres, what the `pg_isready` healthcheck does, and that `--wait` blocks until services report healthy instead of guessing with `sleep`.
7. **Connecting the console** — set the Docker-local connection to `http://localhost:8085/cloud-agent` with the `ADMIN_TOKEN` value, then run the health probe from the Agents page.
8. **Troubleshooting** — a compact symptom → cause → fix list: port already allocated, agent restart loop from a failed DB migration, `init.sql` not running because the volume already existed, image pull failures / arm64 vs amd64 platform mismatch, and how to read the JVM stack trace out of `docker compose logs`.
9. **Data and cleanup** — named volume `pgdata`, how to back it up, and how to reset cleanly.

## Compose Lab alignment

Small, matching improvements so the generated bundle follows the practices the docs now describe:

- Add `restart: unless-stopped` to the three services.
- Add an explicit named network so service DNS names are stable and documented.
- Add a healthcheck for `cloud-agent` against its REST health endpoint, so `--wait` and `depends_on` work end to end.
- Extend the validator's lint output with the checks the docs reference: unpinned (`:latest`) image tags, missing healthcheck on a service other services depend on, host port collisions inside the file, and `.env` values left at their insecure defaults.

## Comparison table

Sharpen the "Docker local" column with the practical trade-off (full fidelity, but localhost-only — no public DIDComm endpoint for external peers without a tunnel), and keep the existing Fly Machines recommendation and the Sprites-is-sandbox-only callout unchanged.

## Technical notes

- Docs content lives in `src/routes/docs.tsx`; the section is presentational, no data fetching.
- Compose template, `.env` defaults and the Python validator live in `src/lib/sprites/compose.server.ts`; lint additions go in the validator script and surface through the existing results UI in `src/components/ComposeLabPanel.tsx`.
- No database, auth, or server-function changes.
