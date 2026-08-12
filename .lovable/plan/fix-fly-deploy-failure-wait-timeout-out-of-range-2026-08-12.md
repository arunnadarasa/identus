# Fix Fly deploy failure: wait timeout out of range

## What went wrong

Provisioning failed at "Wait for Postgres to start" with:

```text
Fly API 400 ... /wait?state=started&timeout=120
invalid_argument: invalid WaitMachineRequest.Timeout: value must be inside range [1s, 1m0s]
```

Fly's machine-wait endpoint accepts a maximum long-poll of 60 seconds. The Postgres wait step
requests 120 seconds, so Fly rejects the request outright and the deploy aborts before the PRISM
node or agent machines are ever created (the log confirms only `identus-postgres` exists, in
`created` state).

## Fix

- Cap every machine wait at 60 seconds, and make waiting a retry loop instead of one long poll:
  poll `/wait?state=started&timeout=30` repeatedly (up to ~3 minutes total), treating a timeout
  response as "not ready yet" rather than a failure.
- Apply the same helper to the Postgres wait step and the agent-machine wait step so both use the
  bounded, retrying version.
- Keep the short settle delay after Postgres reports `started` so initdb can finish creating the
  four databases.
- Surface each poll attempt in the provisioning log so a slow boot reads as progress rather than a
  hang.

## Technical notes

- `waitForMachineState` in `src/lib/identus/fly.server.ts` gains clamping (1–60s) plus an overall
  deadline with repeated polls; a 408/timeout from Fly is retried, other errors still throw.
- `src/lib/identus/fly.functions.ts` replaces the inline `timeout=120` fetch at the Postgres step
  with `waitForMachineState`, and the agent wait step uses the same call.
- No database or UI changes; the existing "Retry" button will re-run the corrected flow.

After this, retry the deploy from the Fly.io tab (use "Clean up app" first if the half-created app
is still there).
