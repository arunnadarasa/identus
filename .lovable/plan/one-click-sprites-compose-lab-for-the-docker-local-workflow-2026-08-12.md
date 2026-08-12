# One-click Sprites "Compose Lab" for the docker-local workflow

## Important constraint first

Sprites.dev micro-sandboxes run plain Linux commands. They do not provide a Docker daemon, container image execution, or multi-service orchestration — that is exactly why hosted agents run on Fly Machines in this project. So a Sprites sandbox **cannot actually start** the Identus `docker-compose` stack (agent + PRISM node + Postgres).

What a Sprites box *can* do fast and usefully for the docker-local workflow:

- generate a complete, pinned `docker-compose.yml` + `.env` for the Identus stack
- validate and lint it (YAML parse, required env vars, port collisions, image tags, service dependency graph)
- render the fully resolved/interpolated config so you see what would run
- produce the exact copy-paste commands to run it on your own machine
- let you edit compose/env snippets in the browser and re-validate in a second

This plan builds that as a second sandbox mode, in one click, alongside the existing SDK snippet sandbox.

## What gets built

1. **Sandbox page gains two tabs**: "SDK snippets" (existing) and "Docker local" (new). One button — "Create compose lab" — provisions/reuses your personal sprite and installs the lab toolkit.
2. **Compose lab bootstrap** (server): installs Python + PyYAML in the sprite, writes a `compose-lab/` workspace with the Identus stack files and a validator script.
3. **Starter compose bundle**: pinned Docker Hub images already proven in this project (`identus/identus-cloud-agent`, `identus/prism-node`, `postgres`), a Postgres init script creating the `pollux`, `connect`, `agent`, `node` databases, and an `.env` with ports, admin token and wallet auth key.
4. **Validate & render actions**: run the validator in the sprite and stream results — errors, warnings, and the resolved compose config — using the existing log viewer.
5. **Copy/download**: "Copy run commands" and "Download bundle" so the validated stack goes straight to your machine, plus a one-click "Add as docker-local agent" that pre-fills the docker-local connection form with the lab's URL and admin key.
6. **Honest UI callout**: a card on the Docker-local tab stating containers don't run inside Sprites, with a link to the docs comparison table.

## Technical notes

- Reuse `src/lib/sprites/sprites.server.ts` (`createSprite`, `writeFile`, `exec`) — no new API surface needed; `exec` over HTTP already works.
- New `src/lib/sprites/compose.server.ts`: bundle file contents (compose, env, init SQL, `validate.py`) + bootstrap script.
- New server functions in `src/lib/sprites/sandbox.functions.ts` (or a sibling `compose.functions.ts` to keep modules thin): `ensureComposeLab`, `validateCompose`, `saveComposeFile`, all `.middleware([requireSupabaseAuth])` and scoped to the caller's sprite.
- Persist the user's edited compose/env text in a new `compose_files` table (user_id, name, content) with RLS scoped to `auth.uid()` and GRANTs for `authenticated`/`service_role`, seeded on first lab creation.
- New components: `src/components/ComposeLabPanel.tsx` (editor + actions + result panel) reusing `ProvisionLogViewer` for streamed output.
- Docs page: extend the existing comparison section with a line that Sprites also powers compose *authoring/validation*, not container execution.

## Out of scope

- Running real containers in Sprites (not possible).
- Changing the Fly Machines provisioning flow.
