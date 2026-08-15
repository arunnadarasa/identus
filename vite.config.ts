// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // The Noir + Barretenberg proving stack ships browser-only WASM whose
    // bindgen glue esbuild's dep optimizer mangles (the dynamic import resolves
    // but WASM instantiation hangs silently). Exclude them so Vite serves the
    // packages untouched as native ESM with their .wasm assets intact.
    optimizeDeps: {
      exclude: ["@noir-lang/noir_wasm", "@noir-lang/noir_js", "@aztec/bb.js"],
    },
  },
});
