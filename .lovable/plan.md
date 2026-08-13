# Fix the "failed deploy, but three machines started" confusion

## What you're seeing

The provisioning log says **failed** with `Fly API 422 on /apps: Name has already been taken`, yet right underneath it lists three machines as **started**. Both are true, and that is the bug:

- The deploy stopped at the very first step, so this deploy created nothing.
- The machine list is looked up by app name, and an app with that name already exists in your Fly organisation (`identus-agent-6b41`, deployed, 3 machines). The console is showing *that* app's machines next to a failure message for a deploy that never got off the ground.

Two further problems follow from it:

- **Retry can never work.** Retry reuses the same app name, so it hits the same 422 forever.
- **"Clean up app" is dangerous here.** It destroys the app by name — which would destroy your existing, running `identus-agent-6b41` deployment, not the failed attempt.

## What to change

1. **Block the collision before deploying.** The name check already exists but does not gate the button. When the chosen name is taken on Fly, mark the field invalid, explain it in place, and disable **Deploy** until the name changes. Re-check on name edits (debounced) and after a failure.

2. **Auto-pick a fresh name.** On a "Name has already been taken" failure, generate a new suggested name immediately, so **Retry** deploys under a name that is free rather than repeating the same error.

3. **Never show a foreign app's machines as deploy output.** Only list machines when this deploy actually created the app. If provisioning failed at the "Create Fly app" step, hide the machine list and instead show a clear note: "An app named X already exists in your organisation — these machines are not from this deploy."

4. **Make cleanup safe.** Only offer **Clean up app** when this deploy created the app. On a name collision, replace it with **Discard this attempt**, which removes the console row and leaves the pre-existing Fly app untouched. Also drop the console row automatically when the first step fails, since nothing was provisioned.

5. **Offer the useful action instead: adopt.** When the name is taken and that app looks like an Identus deploy, surface a one-line prompt to use the existing app picker to adopt `identus-agent-6b41` with its admin key, rather than deploying a duplicate.

## Technical notes

- `src/lib/identus/fly.functions.ts` — `flyPreflight` returns `taken`; keep that and add per-name re-checking. In `provisionFlyAgent`, when the `POST /apps` step fails, delete the just-inserted `agent_connections` row (nothing was created) and return a typed `reason: "name_taken"` so the UI can branch.
- `src/components/FlyDeployPanel.tsx` — gate `deploy()` on a fresh name check; track whether the app was created by this run (`appCreated`) and pass it down; swap the failure actions based on `reason`; regenerate the suggested name on collision.
- `src/components/ProvisionLogViewer.tsx` — accept a flag to suppress the machine list, and render the "app already existed" note in its place.
- `destroyFlyApp` stays as-is for real deploys; the discard path only removes the console row.
