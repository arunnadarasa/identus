// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const require_ = createRequire(import.meta.url);

/**
 * Serve `@noir-lang/noir_wasm`'s published browser bundle verbatim.
 *
 * The package ships a self-contained webpack bundle. When the production
 * bundler (Rolldown) re-processes it, it mis-renames the shadowed globals
 * inside the vendored `@ltd/j-toml` module and emits `const Infinity = Infinity`
 * — so importing the compiler throws "Cannot access 'Infinity' before
 * initialization" (minified: "Cannot access 'j' before initialization") and the
 * ZK demo on /learn dies at the compile step. Only the production build was
 * affected, which is why it worked in preview and failed once published.
 *
 * Fix: never let the bundler touch that file. It is exposed at a stable URL
 * (dev: middleware, build: emitted asset) and loaded with a runtime
 * `import()`, keeping it byte-identical to what npm published.
 */
const NOIR_WASM_URL = "/vendor/noir_wasm/main.mjs";

function noirWasmVendorAsset(): Plugin {
  // `exports` in the package hides the subpath, so resolve the package entry
  // (dist/node/main.js) and walk to the sibling browser bundle.
  const vendorFile = () =>
    join(dirname(dirname(require_.resolve("@noir-lang/noir_wasm"))), "web", "main.mjs");
  const source = () => readFileSync(vendorFile());

  return {
    name: "noir-wasm-vendor-asset",
    configureServer(server) {
      server.middlewares.use(NOIR_WASM_URL, (_req, res) => {
        res.setHeader("content-type", "text/javascript; charset=utf-8");
        res.end(source());
      });
    },
    generateBundle() {
      if (this.environment?.name !== "client") return;
      this.emitFile({
        type: "asset",
        fileName: NOIR_WASM_URL.replace(/^\//, ""),
        source: source(),
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [noirWasmVendorAsset()],
    // The Noir + Barretenberg proving stack ships browser-only WASM whose
    // bindgen glue esbuild's dep optimizer mangles (the dynamic import resolves
    // but WASM instantiation hangs silently). Exclude them so Vite serves the
    // packages untouched as native ESM with their .wasm assets intact.
    optimizeDeps: {
      exclude: ["@noir-lang/noir_wasm", "@noir-lang/noir_js", "@aztec/bb.js"],
    },
  },
});
