# Fix the Sandbox "Cannot find module 'rxdb'" failure

## What's happening

The snippet runner in the sandbox exits with code 1 on `Cannot find module 'rxdb'`, thrown from
`/root/www/node_modules/@hyperledger/identus-edge-agent-sdk/build/index.js`.

Two things confirmed from the npm registry:

- The current SDK release (6.6.0) has no `rxdb` dependency and ships `index.cjs` / `index.mjs` at the
  package root. The `build/index.js` path plus the `rxdb` require belong to an older 5.x-era layout,
  so the box has an old release installed, not the current one.
- The SDK declares `rxjs`, `elliptic`, `buffer`, `core-js` (and test-only tools like `jsdom`,
  `webdriverio`, `@playwright/test`) as *peer* dependencies. The first four are needed at runtime and
  are not guaranteed to be installed by the current unpinned `npm install`.

The install script is unpinned (`npm install @hyperledger/identus-edge-agent-sdk`) and only tails 40
lines of the log, so a stale or wrong resolution is invisible in the provisioning steps.

## The fix

1. **Pin the SDK version** in the sandbox install script instead of installing floating latest, and
   install the runtime peers explicitly in the same command: `rxjs`, `elliptic`, `buffer`, `core-js`.
   Test-only peers (`jsdom`, `webdriverio`, `@playwright/test`) stay out.
2. **Force a clean install path** when the pinned version does not match what is already on disk:
   read the installed version from `node_modules/.../package.json`, and if it differs, remove
   `node_modules` + lockfile before installing. That clears the stale 5.x tree without the user
   needing to know to press "Reinstall".
3. **Verify the SDK actually loads** as a new provisioning step: run a tiny probe that imports the
   SDK and prints its resolved version. If the import throws, the step fails with the real module
   error instead of the failure surfacing later inside a user snippet.
4. **Surface the version in the UI**: show the resolved SDK version on the sandbox card and keep the
   full install log in the step detail (raise the tail from 40 lines) so future resolution problems
   are diagnosable from the provisioning log.
5. **Re-check the starter snippet** — the "Create a Peer DID" snippet uses the default export
   (`SDK.Apollo`, `SDK.Castor`), which is still valid in 6.x; adjust only if the load probe shows
   otherwise.

## Technical notes

- Files touched: `src/lib/sprites/workspace.server.ts` (install/probe scripts, pinned version
  constant), `src/lib/sprites/sandbox.functions.ts` (new "Verify SDK loads" step, capture version),
  and the sandbox page/panel component to render the version.
- Sprites API usage stays as-is: `PUT /fs/write` for files, `POST /exec` with `Authorization` only
  (no `Accept` header), service on port 8080 from `/root/www`.
- No database schema change; the resolved version rides along in the existing `provision_log` /
  `sdk_ready` fields.
- After the change, the sandbox needs one "Reinstall" pass (or the automatic mismatch cleanup in
  step 2) to drop the old tree.
