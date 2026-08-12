# Decision: keep Fly Machines as the hosted agent mode

Sprites (sprites.dev) will not be used. The three agent modes stay as built: simulated, docker local, and Fly.io.

## Why

A sprite is a single Linux micro-sandbox: you write files into it and register long-running commands with an HTTP port. It offers no Docker image execution, no multi-container composition, and no managed Postgres. The Identus Cloud Agent is distributed as Docker images (`identus/identus-cloud-agent`, `identus/prism-node`) and requires a Postgres instance with three separate databases alongside a JVM PRISM node. Fly Machines already models exactly that: one machine per image, a shared private network, and a Postgres machine with a volume.

## Change to make

One small documentation change, no functional code:

- In the Docs area, add a short "Why Fly.io for hosted agents" note under the deployment section explaining the reasoning above, so the choice is recorded in the app itself rather than only in chat.

## Not doing

- No Sprites client, no `SPRITES_TOKEN` secret, no fourth agent mode.
- No changes to provisioning, health checks, readiness polling, or credential rotation.
