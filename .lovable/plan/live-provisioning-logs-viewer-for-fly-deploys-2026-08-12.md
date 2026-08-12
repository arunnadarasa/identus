# Live provisioning logs viewer for Fly deploys

Today the Fly deploy panel shows a short list of completed steps, and the log is
only visible while that deploy is running in the current browser session. When a
deploy fails, the underlying Fly API error is squeezed into one line and any
earlier detail is lost. This adds a real log viewer.

## What you get

1. **Richer step records.** Each provisioning step is written to the database
   *before* it runs (as `running`) and updated when it finishes, with duration,
   the Fly endpoint that was called, HTTP status, and — on failure — the full
   Fly error body instead of a truncated line.
2. **A dedicated log viewer.** A terminal-style panel with one row per step:
   status icon, step name, elapsed time, timestamp. Rows expand to show the raw
   detail (request path, status code, error body). Auto-scrolls while running.
3. **Live streaming.** While a deploy is in flight the viewer polls every ~2s
   and keeps polling after a page refresh, so closing and reopening the tab does
   not lose the log.
4. **Logs for every Fly agent, not just the live deploy.** Each Fly connection
   card on the Agents page gets a "View provisioning log" action that opens the
   same viewer for that app's stored log — including failed deploys you want to
   inspect later.
5. **Machine status snapshot.** After the machines are created, the viewer also
   lists each Fly machine (postgres, PRISM node, cloud agent) with its current
   Fly state, refreshed on the same poll, so you can see which container failed
   to start.
6. **Copy / retry affordances.** "Copy log" puts the whole log as plain text on
   the clipboard for pasting into an issue, and a failed deploy keeps the
   existing cleanup/retry buttons next to the log.

## Technical detail

- `src/lib/identus/types.ts`: extend `ProvisionStep` with optional
  `durationMs`, `endpoint`, `httpStatus`, and `raw` fields (all optional, so
  existing stored logs still render).
- `src/lib/identus/fly.server.ts`: have `fly()` throw a `FlyApiError` carrying
  `path`, `status`, and the full response body; add `listMachines(appName)`
  returning `{ id, name, state, region }[]`.
- `src/lib/identus/fly.functions.ts`: replace the ad-hoc `steps.push` calls with
  a `runStep(name, fn)` helper that persists a `running` entry, awaits the call,
  then rewrites the entry with `ok`/`error`, duration and error detail. Same
  step names as today so nothing regresses.
- New `getProvisionLog` server function (auth-scoped, `requireSupabaseAuth`)
  returning `{ provision_status, provision_log, machines }` for one connection
  id; machines are fetched from Fly only when the app name is set.
- New `src/components/ProvisionLogViewer.tsx`: presentational + polling
  component driven by `connectionId` and a `live` flag, using TanStack Query
  with `refetchInterval` while status is `provisioning`.
- `src/components/FlyDeployPanel.tsx`: swap the inline step list for
  `<ProvisionLogViewer />`; drop the local `liveSteps` derivation now that the
  viewer owns polling.
- `src/routes/app.agents.tsx`: add the "View provisioning log" trigger on Fly
  connection cards, rendering the viewer in a collapsible section.

No database migration is required — `provision_log` is already JSONB.
