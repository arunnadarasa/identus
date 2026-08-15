# Vite configuration for the Noir proving stack

The whole configuration is two things: exclude the packages from dep optimization, and serve
`noir_wasm`'s published browser bundle byte-identically. Everything else is default.

```ts
// vite.config.ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const require_ = createRequire(import.meta.url);
const NOIR_WASM_URL = "/vendor/noir_wasm/main.mjs";

function noirWasmVendorAsset(): Plugin {
  // `exports` hides the ./web subpath, so resolve the package entry
  // (dist/node/main.js) and walk to the sibling browser bundle.
  const vendorFile = () =>
    join(dirname(dirname(require_.resolve("@noir-lang/noir_wasm"))), "web", "main.mjs");
  const source = () => readFileSync(vendorFile());

  return {
    name: "noir-wasm-vendor-asset",
    configureServer(server) {
      // dev: plain middleware, no transform pipeline
      server.middlewares.use(NOIR_WASM_URL, (_req, res) => {
        res.setHeader("content-type", "text/javascript; charset=utf-8");
        res.end(source());
      });
    },
    generateBundle() {
      // build: emit as an asset so no JS transform ever touches it
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
  vite: {
    plugins: [noirWasmVendorAsset()],
    optimizeDeps: {
      exclude: ["@noir-lang/noir_wasm", "@noir-lang/noir_js", "@aztec/bb.js"],
    },
  },
});
```

## Why each piece exists

- **`optimizeDeps.exclude`** — esbuild's optimizer rewrites wasm-bindgen glue. The import resolves,
  then `WebAssembly` instantiation hangs forever with no error. Excluding all three makes Vite serve
  them as native ESM with their `.wasm` assets intact.
- **`emitFile` as `type: "asset"`** — an asset is copied verbatim. Adding the file as an entry or
  letting it be imported statically puts it back through Rolldown, which reintroduces the
  `const Infinity = Infinity` breakage in the vendored `@ltd/j-toml` module.
- **`this.environment?.name !== "client"`** — without the guard the file is emitted twice (client and
  SSR builds) and one overwrites the other in the wrong output directory.
- **`require_.resolve` at call time, not module scope** — keeps a missing dependency from breaking the
  whole config load.

## Consumption side

```ts
const NOIR_WASM_URL = "/vendor/noir_wasm/main.mjs";

const [noirWasm, { Noir }, bb] = await Promise.all([
  import(/* @vite-ignore */ NOIR_WASM_URL) as Promise<{
    compile: (fm: unknown) => Promise<unknown>;
    createFileManager: (root: string) => {
      writeFile: (path: string, stream: ReadableStream) => Promise<void>;
    };
  }>,
  import("@noir-lang/noir_js"),
  import("@aztec/bb.js"),
]);
```

`/* @vite-ignore */` on a variable specifier is required — without it Vite tries to resolve the URL at
build time and fails, or worse, inlines the module and undoes the fix. Type the shape inline since the
runtime import carries no types.

## Do not

- Copy `main.mjs` or the `.wasm` files into `public/` by hand — they drift from the installed version
  and the wasm path resolution breaks.
- Add `ssr.external` / `resolve.external` for these packages — the Worker SSR build has no runtime
  module resolution and this is a hard build failure.
- Set COOP/COEP headers just to try multi-threading; it breaks embedded third-party SDKs.
- Verify only in dev. This class of bug is production-only: always check a production build.
