# Fix DIDComm invitations and the credential-offer snippet

## What the screenshots show

- "Create a connection invitation" succeeds (`exit 0`), but the invitation URL is `https://my.domain.com/path?_oob=...` — a placeholder host, not your Fly agent. Nothing can accept an invitation pointing at a domain you don't own, so the connection stays in `InvitationGenerated` forever.
- "Issue a credential offer" therefore prints "No established connection yet" and exits — that's the guard working as designed, not a snippet bug. The root cause is upstream: no connection can ever reach `ConnectionResponseSent`.

Two things in the deployment plausibly cause the placeholder host, and the fix starts by confirming which:

1. `src/lib/identus/fly.server.ts` sets `DIDCOMM_SERVICE_URL` to `https://<app>.fly.dev/didcomm` at machine-create time, so a machine created before that line existed still carries the agent's built-in default. Needs checking against the machine actually running.
2. The Fly machine only publishes internal port `8085` (REST). The DIDComm port `8090` is not exposed by any service, so even with a correct URL an external wallet or a second agent cannot deliver DIDComm messages to it.

## Plan

1. **Confirm the live config first.** Read the deployed machine's env and services back from the Fly API (existing machine-inspect path in `fly.server.ts` / the diagnostics panel) and compare against what the deploy code intends. Report which of the two causes above is real before changing behaviour.

2. **Expose DIDComm on the Fly machine.** Add a second service to `agentMachineConfig` publishing `internal_port: 8090` over HTTP/TLS (its own port, e.g. 8090 externally), and set `DIDCOMM_SERVICE_URL` to that exact reachable URL so the value the agent stamps into invitations matches where messages can actually arrive.

3. **Surface the mismatch in the console.** In the agent health/diagnostics panel, create a throwaway invitation (or read an existing one), parse the `_oob` host, and warn when it isn't the agent's own hostname — with a "Redeploy agent" hint. This turns a silent dead end into a visible finding.

4. **Add a "Repair endpoint config" action** for agents already deployed with the wrong env: update the machine config in place with the corrected `DIDCOMM_SERVICE_URL` and the 8090 service, then restart and re-probe, reusing the existing repair/update flow rather than forcing a full redeploy.

5. **Make the credential-offer snippet actually complete.** Instead of exiting when no established connection exists, fall back to a **connectionless offer** (omit `connectionId`, pass `goalCode`/`goal`, print the returned invitation URL) — the same path the console's Credentials page already uses. The snippet keeps preferring an established connection when one exists. Bump its `version` so saved copies are flagged stale and can be refreshed with "Use current version".

6. **Same treatment for the connection snippet:** after creating the invitation, print a short note when the invitation host is a placeholder, pointing at the repair action.

## Technical notes

- Files touched: `src/lib/identus/fly.server.ts` (services + env + repair), the Fly diagnostics component, and `src/lib/sprites/snippets.ts` (offer + connection snippets, version bumps).
- No schema change needed; snippet staleness already uses `template_version`.
- Step 1 is diagnostic only — if the live machine already carries the right `DIDCOMM_SERVICE_URL`, the fix narrows to exposing 8090 and the snippet fallback.
