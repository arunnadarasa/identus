# Fix the ZK proof demo on the published site

## What's happening

On the live site (`identus.lovable.app/learn`), pressing **Generate proof** fails at the first step with `Cannot access 'j' before initialization`. In the preview/dev environment the same demo works end to end.

That split is the tell: the failure comes from how the production bundle is assembled, not from the circuit or the demo code. The proving stack (`@noir-lang/noir_wasm`, `@noir-lang/noir_js`, `@aztec/bb.js`) has a heavy re-export graph, and the production bundler reorders/drops declarations in it so one module's variable is read before it is defined. The existing `optimizeDeps.exclude` fix only applies to dev, which is why the published build is still broken.

## Plan

1. Reproduce it locally against a real production build (not the dev server), and confirm the failing identifier lives in a bundled Noir/Barretenberg chunk.
2. Apply the fix in build config, one step at a time, rebuilding and re-testing the proof flow after each:
   - Disable tree-shaking for the production bundle so declarations in those packages are no longer dropped.
   - If that isn't enough, stop bundling the proving stack altogether: load `noir_wasm`/`noir_js`/`bb.js` as standalone browser modules at click time (they are already behind a lazy, client-only boundary), so the bundler never rewrites their glue code.
3. Verify with a headless browser against the production build: all four steps (compile → witness → prove → verify) go green, the **Verified** badge appears, the public output shows the threshold year, and the **Tamper** button still produces a rejection. Check the console is clean.
4. Leave a short comment in `vite.config.ts` next to the change explaining why it exists, so it isn't removed later.

No changes to the circuit, the demo UI, or any other page.

## Technical notes

- Stack is Vite 8 (Rolldown) — the symptom (`Cannot access 'X' before initialization` / `X$N is not defined` from a hashed asset chunk) is a known bundler correctness issue with packages of this shape.
- Fix lives in `vite.config.ts` under `vite.build`; the current `optimizeDeps.exclude` entry stays (it fixes dev).
- Must be validated with a production build; `build:dev` will not reproduce the bug.
