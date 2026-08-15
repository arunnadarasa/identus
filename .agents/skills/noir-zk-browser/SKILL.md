---
name: noir-zk-browser
description: Use when generating or verifying zero-knowledge proofs in the browser with Noir and the Barretenberg UltraHonk prover in a Lovable/TanStack Start app — writing or compiling a zk circuit, wiring noir_wasm/noir_js/bb.js through Vite, or debugging a proof that hangs, throws "Cannot access 'j' before initialization", or fails to verify. Triggers on "noir", "nargo", "zero-knowledge proof", "zk circuit", "ultrahonk", "barretenberg", "bb.js", "selective disclosure proof".
---

# Noir zero-knowledge proofs in the browser

## When to use

- Adding a client-side ZK proof (age/range check, hash binding, set membership) to a web app.
- Compiling Noir source at runtime instead of shipping a precompiled ACIR artifact.
- Debugging a prover that hangs silently, dies only in production, or blows up wasm memory.
- Designing the UX around a multi-megabyte prover download and a proving step that can exceed a minute on mobile.

## Packages

| Package | Role | Pinned here |
| --- | --- | --- |
| `@noir-lang/noir_wasm` | compiles Noir source → ACIR bytecode | `1.0.0-beta.26` |
| `@noir-lang/noir_js` | witness generation (`new Noir(program).execute(inputs)`) | `1.0.0-beta.26` |
| `@aztec/bb.js` | Barretenberg backend: `UltraHonkBackend` prove/verify | `5.1.0` |

Keep `noir_wasm` and `noir_js` on the **same** beta version — the ACIR format changes between betas and
a mismatch surfaces as an opaque witness-generation failure. `bb.js` must support the ACIR version
those two emit; upgrade all three together, never one.

## Two bundler traps (both mandatory)

Both are configured in `vite.config.ts`; read [bundler-config](references/bundler-config.md) for the
full plugin with commentary.

1. **Never let the dep optimizer pre-bundle the proving stack.**
   ```ts
   optimizeDeps: { exclude: ["@noir-lang/noir_wasm", "@noir-lang/noir_js", "@aztec/bb.js"] }
   ```
   esbuild rewrites the wasm-bindgen glue; the dynamic import still resolves, then wasm
   instantiation **hangs with no error**. A ZK step that never completes and never throws is this.

2. **Serve `noir_wasm`'s published browser bundle verbatim.**
   The package ships a self-contained webpack bundle. Rolldown re-processing it mis-renames shadowed
   globals in the vendored `@ltd/j-toml` module and emits `const Infinity = Infinity`, so importing the
   compiler throws `Cannot access 'Infinity' before initialization` — minified: **`Cannot access 'j'
   before initialization`**. It only breaks the production build, so preview looks fine and the
   published site dies.
   Fix: expose `node_modules/@noir-lang/noir_wasm/web/main.mjs` at a stable URL (dev middleware +
   `emitFile` in `generateBundle`) and load it with `import(/* @vite-ignore */ "/vendor/noir_wasm/main.mjs")`
   so the bundler never rewrites it.

## Threading and isolation

```ts
const api = await bb.Barretenberg.new({ threads: 1 });
const backend = new bb.UltraHonkBackend(program.bytecode, api);
```

`threads: 1` works on any origin. Multi-threaded proving needs `SharedArrayBuffer`, which requires
cross-origin isolation (`COOP: same-origin`, `COEP: require-corp`) — headers that also break
third-party embeds (wallet SDKs, iframes, analytics). Stay single-threaded unless proving time is the
product.

## Compile in the browser

```ts
const fm = createFileManager("/");
await fm.writeFile("./src/main.nr", new Blob([CIRCUIT_SOURCE]).stream());
await fm.writeFile("./Nargo.toml", new Blob([NARGO_TOML]).stream());
const compiled = await compile(fm);
const program = "program" in compiled ? compiled.program : compiled;
```

`compile` returns `{ program }` on some betas and the program directly on others — normalise as above.
`Nargo.toml` needs `[package] name/type = "bin"` and an empty `[dependencies]`; omitting it fails
compilation with a path error, not a missing-manifest error.

## Circuit shape

```rust
fn main(
    dob_year: u32,
    credential_hash_lo: Field,
    credential_hash_hi: Field,
    threshold_year: pub u32,
) -> pub Field {
    assert(dob_year <= threshold_year);
    std::hash::pedersen_hash([credential_hash_lo, credential_hash_hi])
}
```

- Inputs are private unless marked `pub`. The return value is always public.
- Returning a deterministic commitment (Pedersen over the secret binding) lets a verifier tell
  *which* secret the proof is about without learning it, and lets two proofs be linked to one source.
- A SHA-256 digest does not fit one `Field` (BN254 ≈ 254 bits). Split it into two 128-bit limbs.
- `assert` is the whole security statement — every claim the UI makes must correspond to an assert or
  to the returned commitment. See [circuit-patterns](references/circuit-patterns.md).

## Prove and verify

```ts
const { witness } = await noir.execute({ dob_year, credential_hash_lo, credential_hash_hi, threshold_year });
const proof = await backend.generateProof(witness);   // { proof, publicInputs }
const ok = await backend.verifyProof(proof);
```

Flipping a byte of `proof.proof` (or a public input) must make `verifyProof` return `false` — wire
that tamper check into the demo; it is the only convincing evidence the proof is real.

## UX budget (measured on mid-range mobile)

| Phase | Budget | Notes |
| --- | --- | --- |
| load (compiler + prover wasm) | 90s | tens of MB on first visit, then HTTP-cached |
| compile circuit | seconds | in-memory |
| witness generation | 30s | cheap for small circuits |
| prove (UltraHonk, 1 thread) | 180s | dominates; can exceed 60s on mobile |
| verify | 60s | fast, but keep a ceiling |

- Wrap each phase in an explicit timeout with a phase-specific message; an unbounded await is
  indistinguishable from the silent optimizer hang.
- The wasm is fetched **internally** by the libraries, so `fetch` progress callbacks are unavailable.
  Use a `PerformanceObserver` on `resource` entries filtered to `.wasm`/`.mjs` and report
  `transferSize` for real byte counts.
- Cache the `{ program, noir, backend }` session in a ref; on any failure clear it so the retry
  re-downloads rather than reusing a half-initialised backend.
- Provide "Retry" and "Reload the prover" actions, and say plainly that ad-blockers, offline mode, and
  strict proxies can block wasm.

## SSR rules

`crypto.subtle`, `PerformanceObserver`, `WebAssembly` streaming, and the compiler all need a browser.
Keep the prover in a client-only entry (`<ClientOnly>` + `React.lazy`) and import the packages inside
the handler, not at module scope — a static import pulls multi-megabyte wasm glue into SSR and the
initial bundle.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Step never completes, no error | dep optimizer pre-bundled the packages | add all three to `optimizeDeps.exclude` |
| `Cannot access 'j' before initialization` (prod only) | Rolldown rewrote noir_wasm's vendored bundle | serve `web/main.mjs` verbatim, `import(/* @vite-ignore */ url)` |
| `Cannot find module` / wasm 404 | wasm asset not emitted next to its glue | do not copy the package into `public/`; let Vite serve it untouched |
| Witness generation throws on valid inputs | `noir_js` / `noir_wasm` version skew | pin both to the same beta |
| `RuntimeError: memory access out of bounds` | circuit too large for single-threaded wasm memory | shrink the circuit or enable COOP/COEP + threads |
| `verifyProof` false with correct inputs | public inputs reordered, or backend rebuilt from different bytecode | rebuild the backend from the compiled program used to prove |
| Hydration mismatch / `crypto.subtle` undefined | prover imported during SSR | move to a client-only entry, dynamic import |
| `SharedArrayBuffer is not defined` | `threads > 1` without isolation | use `threads: 1` |

## Honest claims

State what the circuit proves and what it does not. Hashing a signed credential and asserting a range
proves knowledge of a preimage plus the range — it does not check the issuer signature inside the
circuit. Verify signatures outside, and say where the trust boundary is.
