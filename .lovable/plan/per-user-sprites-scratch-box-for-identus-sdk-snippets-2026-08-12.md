# Per-user Sprites scratch box for Identus SDK snippets

A sandbox page where each signed-in user gets their own sprites.dev micro-VM with Node and the Identus TypeScript SDK installed, so snippets can be run against the currently active agent without deploying anything.

This is the SDK-sandbox use of Sprites — it does not host an agent (Sprites cannot run the Identus container stack). The three agent modes stay as they are.

## What you'll get

A new **Sandbox** page in the console:

- **Box status card** — creates your sprite on first visit (one per account, named from your user id), shows state and its public URL, with actions to reset or destroy it.
- **Snippet editor** — a code pane pre-loaded with runnable starter snippets: create a Peer DID, resolve a PRISM DID, start a connection invitation, issue and verify a credential, and a raw `fetch` against the agent REST API.
- **Run output** — stdout/stderr and exit code streamed back from the box after each run.
- **Agent binding** — the run injects `AGENT_BASE_URL` and `AGENT_API_KEY` from your active console agent (simulated mode is rejected with a clear message, since there is no real REST endpoint to hit).

## How it works

On first use, the box is provisioned once: create the sprite, write a small workspace to `/root/www`, `npm init` and install `@hyperledger/identus-sdk`, then register a long-running keepalive service so the box wakes on request. Provisioning progress reuses the existing provisioning-log viewer. Every run writes the snippet to a file and executes it, returning combined output.

Snippets and their last output are stored per user so the page survives a reload.

## Setup you'll need to do

Sprites needs its own token, which is **not** your Fly.io token. I'll ask for `SPRITES_TOKEN` — copy the 4-part `org-slug/org-id/token-id/token-value` value from your account page at sprites.dev. A raw Fly org token is rejected with "authentication failed".

## Technical notes

- `src/lib/sprites/sprites.server.ts` — REST client for `https://api.sprites.dev/v1` with bearer auth: create (POST-only; GET-then-POST for idempotency), `PUT /fs/write` for file placement, `PUT /services/{name}` with a required `http_port`, NDJSON start stream, and HTTP `exec` with `Authorization` as the only header (an `Accept` header returns 406). Services run from `/root/www`; exec output ends with `0x03 <exitCode>`.
- `src/lib/sprites/sprites.functions.ts` — `ensureScratchBox`, `runSnippet`, `resetScratchBox`, `destroyScratchBox`, all `requireSupabaseAuth`, resolving the caller's active agent for env injection. No timeouts on installs or runs beyond generous per-call budgets.
- Migration: `sprite_boxes` (one row per user: sprite name, url, status, provision log, timestamps) and `sprite_snippets` (name, code, last output, per user), both with GRANTs and owner-only RLS.
- `src/routes/app.sandbox.tsx` plus `src/components/SnippetRunner.tsx`; a nav entry in `AppShell`.
