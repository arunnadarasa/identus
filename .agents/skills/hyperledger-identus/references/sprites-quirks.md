# Sprites.dev quirks reference

## Token format

`SPRITES_TOKEN` must be the 4-part token `org-slug/org-id/token-id/token-value` from sprites.dev/account. A raw Fly.io token returns 401 with a misleading "authentication failed" message. The error in `SpritesApiError` calls this out explicitly.

## API client (`src/lib/sprites/sprites.server.ts`)

Base: `https://api.sprites.dev/v1`. Auth: `Authorization: Bearer <token>`.

Quirks that matter (documented inline in the file):

- **Create is POST-only.** `PUT /sprites/{name}` returns 404; use `POST /sprites` with a JSON body `{ name, url_settings: { auth: "public" } }`.
- **Services are PUT-addressed** and need `http_port` for wake-on-request. A stale definition keeps the old command/port bound, so `putService` deletes the old one first (404/405 are ignored).
- **`exec` must send Authorization only.** An `Accept` header returns 406. The body is raw bytes ending with `0x03 <exitCode>`; `exec()` parses the trailing two bytes to extract the exit code.
- **`PUT /fs/write` creates parent directories** — no separate `mkdir` exec needed.
- **Services must run from `/root/www`** (`/home/sprite` may not exist). `SPRITE_DIR = "/root/www"`, `SPRITE_SERVICE = "webapp"`.

## Exec framing

```ts
const bytes = new Uint8Array(await res.arrayBuffer());
const hasExit = bytes.length >= 2 && bytes[bytes.length - 2] === 3;
const exitCode = hasExit ? bytes[bytes.length - 1] : null;
const stdout = new TextDecoder().decode(hasExit ? bytes.slice(0, -2) : bytes);
```

## Env injection

`envExport(vars)` builds base64-decoded export lines so quoting can't break: `export KEY="$(printf %s '<b64>' | base64 -d)"`. The sandbox uses this to inject `AGENT_BASE_URL` and `AGENT_API_KEY` into the snippet environment.

## Warm-up

`warmUrl(url, attempts=10)` polls the public URL with 1.2s spacing so the box is awake before handing it to the user. Cold boots take a few seconds.

## Compose Lab

Sprites cannot run Docker containers. The Compose Lab (`src/lib/sprites/compose.server.ts`) is for **authoring and linting** compose files only. `DEFAULT_COMPOSE` is the canonical Identus stack template with healthchecks, a named network, and `restart: unless-stopped`. A Python validator flags insecure passwords, missing healthchecks, and weak dependency conditions. Saved compose files live in the `compose_files` table.
