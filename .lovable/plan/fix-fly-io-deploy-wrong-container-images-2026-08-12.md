# Fix Fly.io deploy: wrong container images

## What's happening

The deploy fails at the PRISM node step with:

```text
Fly API 400 on /apps/identus-agent-7103/machines:
{"error":"failed to get manifest ghcr.io/hyperledger-identus/prism-node:latest: unauthorized"}
```

The Postgres steps succeed, so the token, app and volume are all fine. The
problem is the image coordinates: the deploy points at
`ghcr.io/hyperledger-identus/prism-node` and
`ghcr.io/hyperledger-identus/cloud-agent`, and neither of those packages is
publicly pullable — GitHub's registry answers "unauthorized" for anonymous
pulls, which Fly reports as a 400.

Verified against the registries just now: the Identus project publishes its
public images on Docker Hub instead.

- `identus/identus-cloud-agent` — tags `latest`, `1.40.0`, `1.39.0`
- `identus/prism-node` — tags `latest`, `2.5.0`, `2.4.1`

## The fix

1. Point the deploy at the public Docker Hub images, pinned to known-good
   versions rather than `latest` so a new upstream release can't silently
   break provisioning:
   - agent: `docker.io/identus/identus-cloud-agent:1.40.0`
   - PRISM node: `docker.io/identus/prism-node:2.5.0`
2. Create the three databases the Cloud Agent expects. Right now every
   database name (`pollux`, `connect`, `agent`) is set to the single `agent`
   database, which makes the agent's schema migrations collide on boot. The
   Postgres machine gets an init step that creates `pollux`, `connect` and
   `agent`, and the agent machine gets the matching per-component names.
3. Surface registry problems clearly: when Fly returns a manifest/unauthorized
   error, the provisioning log entry names the image that failed and says the
   image is not publicly pullable, instead of only echoing the raw Fly body.
4. Leave the failed `identus-agent-7103` app in place — it can be removed with
   the existing "Destroy" button on its card before redeploying.

## Technical notes

- `src/lib/identus/fly.server.ts`: replace `AGENT_IMAGE` / `PRISM_NODE_IMAGE`
  constants; add the multi-database bootstrap to the Postgres machine config
  (init command creating the three databases) and split `POLLUX_DB_NAME`,
  `CONNECT_DB_NAME`, `AGENT_DB_NAME`.
- `src/lib/identus/fly.functions.ts`: map Fly manifest errors to a friendlier
  step detail while keeping the raw body in the expandable diagnostics.
- No database migration and no UI restructuring needed; the readiness watcher
  and provisioning log viewer keep working as-is.

## How we'll know it worked

Redeploy from the Fly.io tab: the provisioning log should get past "Start
PRISM node machine" to the agent machine, and the readiness watcher should
flip to ready once `/cloud-agent/_system/health` responds.
