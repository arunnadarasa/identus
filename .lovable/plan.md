# Fix the live Noir/ZK proof demo (Vite dep-optimizer breaking WASM)

## Problem (confirmed)

On `/learn#zk`, clicking "Generate proof" spins forever on the first step
("Compile the Noir circuit") with no console error. The dev log shows
`[optimizer] bundling dependencies...`.

Root cause: Vite's dep optimizer (esbuild) pre-bundles the three WASM-backed
packages — `@noir-lang/noir_wasm`, `@noir-lang/noir_js`, `@aztec/bb.js` — and in
doing so mangles their WASM-bindgen glue (`noir_wasm/dist/web/main.mjs` +
`index_bg.wasm`, `bb.js` browser entry). The dynamic `import()` resolves, but
the WASM instantiation inside `compile()`/`Barretenberg.new()` hangs silently.
These packages are designed to be loaded as-is so their `.wasm` assets and
`new URL(..., import.meta.url)` references resolve intact.

## Fix

Single change to `vite.config.ts`: pass an `optimizeDeps.exclude` list through
the Lovable config wrapper's `vite` option (it merges via `mergeConfig`, so this
composes cleanly with the wrapper's existing `include` array).

```ts
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    optimizeDeps: {
      exclude: ["@noir-lang/noir_wasm", "@noir-lang/noir_js", "@aztec/bb.js"],
    },
  },
});
```

Excluded packages are served as native ESM straight from `node_modules`,
preserving their WASM asset references and the `browser` export condition that
`bb.js` relies on.

No SSR changes needed — the component is already gated behind `<ClientOnly>`
+ `React.lazy`, so these packages never enter the SSR graph.

## Steps

1. Edit `vite.config.ts` to add the `vite.optimizeDeps.exclude` block above.
2. Clear the stale optimizer cache: `rm -rf node_modules/.vite`.
3. Restart the dev server (kill the vite process so the supervisor respawns it).
4. Re-test in the browser: load `/learn#zk`, click "Generate proof", and confirm
   the four steps (compile → witness → prove → verify) complete and show
   "Verified", plus that "Tamper with the proof" flips it to "Rejected".

## Why not other approaches

- `optimizeDeps.esbuildOptions.loader` / WASM loader tweaks: the packages ship
  their own instantiation glue; a loader override doesn't restore the broken
  ESM re-exports that esbuild's pre-bundle introduces. Excluding is the correct
  signal: "serve these untouched."
- COOP/COEP headers: not needed — the code already pins `threads: 1`, which
  avoids the cross-origin-isolation requirement. The hang is not a threads
  issue; it's a broken-module issue.
