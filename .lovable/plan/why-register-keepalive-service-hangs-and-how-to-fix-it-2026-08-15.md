# Why "Register keepalive service" hangs — and how to fix it

## What I actually observed

Your latest sandbox provision is still recorded as **running** on that step:

```text
Look up sandbox                 561 ms   ok
Write workspace files           124 ms   ok
Check Node runtime              998 ms   ok
Install Identus TypeScript SDK  10.7 s   ok
Verify SDK loads                961 ms   ok
Register keepalive service       —       running   (08:44:37, never finished)
```

So it is not "slow work" — the step never returned an answer, success or failure, for
minutes. Two things in the code make that possible:

1. **No call ever times out.** Every sandbox API call is a plain `fetch` with no abort
   signal, so a request that stalls upstream stalls the whole provisioning request until
   the server itself gives up. The UI just keeps showing "running".
2. **Registering the service always deletes the old one first**, even when the box is
   already running the exact same keepalive command. That extra stop-then-recreate is
   the only new thing this step does, and it is the call that stalled.

There is a third, related bug on the next step: starting a service returns a streaming
NDJSON log, and the code reads the **entire** stream (`await res.text()`) before
continuing. A keepalive web server never exits, so that stream can stay open — the
sandbox docs explicitly say to parse those frames incrementally instead.

I have not confirmed *why* the upstream delete stalled (no logs were retained for that
window), so the plan makes the step self-limiting and diagnosable rather than assuming
one upstream cause.

## The fix

1. **Time-box every sandbox API call.** Give each request an abort signal with a
   sensible budget (short for lookups/service calls, generous for the SDK install), and
   report a clear "timed out after Ns" step failure instead of an endless "running".
2. **Stop recreating the keepalive service needlessly.** Read the current service
   definition first; if the command, directory and port already match, skip the delete
   and the re-register entirely and mark the step "already registered". Only fall back
   to delete-then-put when the definition actually differs.
3. **Read the start stream incrementally.** Consume NDJSON line by line, stop as soon as
   an error/exit frame arrives or the first healthy frames land, and cap the read so a
   long-lived service can never block the step.
4. **Make a stuck step visible in the UI.** In the sandbox provisioning panel, show
   elapsed time on the currently running step and, past the budget, a "this step is
   taking longer than expected — Retry / Repair box" hint so you are never staring at a
   silent spinner.
5. **Leave a resumable state.** On timeout, persist the box as `error` with the failing
   step so the next "Ensure box" run picks up from a known state instead of re-doing the
   SDK install.

## Technical notes

- `src/lib/sprites/sprites.server.ts`: add a shared `withTimeout` wrapper used by
  `request`, `exec`, `startService`; add `getService` and make `putService` idempotent;
  rewrite `startService` to stream via `res.body.getReader()` with a hard cap.
- `src/lib/sprites/sandbox.functions.ts`: classify timeout errors into the step entry
  (`httpStatus: 408`-style detail), and persist `error` status on abort.
- Sandbox UI panel: live elapsed timer for the running step plus the slow-step hint.
- No database or schema changes; no change to the SDK install or verify logic.
