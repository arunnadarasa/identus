# Real zero-knowledge proof in the /learn ZK section

Today the ZK toggle is illustrative: it shows which fields would leak versus a placeholder "π (proof)" chip. This replaces the ZK side with an actual proof, generated and verified in the browser with Noir.

## What the visitor will do

1. In the Zero-knowledge section, a new **"Prove I'm over 18 — for real"** panel appears under the existing comparison.
2. They enter (or accept a prefilled) date of birth. That value never leaves the browser and is never shown to the "verifier" side of the panel.
3. Press **Generate proof**. The panel streams its steps: compile circuit → compute witness → generate proof → verify.
4. Result: a real proof blob (hex, truncated with the existing `MonoValue` treatment) plus a green **Verified** state, with the public inputs shown — only the threshold year and the boolean outcome, not the date of birth.
5. A **Tamper** button flips a byte of the proof and re-verifies, which fails — proving verification is genuinely cryptographic, not simulated.
6. If the date of birth is under 18, proof generation fails at the witness step, because the circuit's assertion cannot be satisfied. That failure is the honest demonstration: you cannot produce a proof of a false statement.

The existing explainer text, opportunity cards and the plain-vs-ZK chip comparison stay. The closing "where this fits today" note gets rewritten: the live proof is real Noir; Identus credential presentations still use JWT-VC selective disclosure, with AnonCreds/BBS+ as the ZK-native path.

## The circuit

A small Noir program, kept as a string constant in the app:

```text
fn main(dob_year: u32, threshold_year: pub u32) {
    assert(dob_year <= threshold_year);
}
```

`dob_year` is private, `threshold_year` is public. Later iteration can bind this to a credential commitment; for the explainer the age predicate is the point.

## Technical notes

- Packages: `@noir-lang/noir_js`, `@noir-lang/noir_wasm`, `@noir-lang/acvm_js`, `@noir-lang/noirc_abi`, and `@aztec/bb.js` for the UltraHonk backend. Pin matching versions across the Noir packages.
- Compilation happens in-browser via `noir_wasm`'s `createFileManager` + `compile` from the inline source, so no `nargo` toolchain and no committed build artifact.
- Everything is browser-only WASM. Follow the existing `PrivyRoot` pattern: a `ZkProofLive` wrapper using `ClientOnly` + `lazy(() => import("./zk-proof-client-entry"))`, so nothing enters the SSR graph. The heavy imports live inside the lazy entry and, where possible, inside the click handler so the bundle is not fetched until the visitor asks for a proof.
- bb.js needs cross-origin isolation for multithreading; construct the backend with `threads: 1` so it works without COOP/COEP headers. Expect a few seconds on first proof and label the button state accordingly.
- Vite: add the Noir/bb.js wasm packages to `optimizeDeps.exclude` if the dev server chokes on their wasm imports, and keep them out of any SSR external config.
- Files: new `src/components/learn/ZkProofLive.tsx` (wrapper) and `src/components/learn/zk-proof-client-entry.tsx` (circuit source, proving/verifying logic, UI). `src/components/learn/ZkProof.tsx` renders the wrapper and gets its closing note updated. No route or backend changes.
- Verification: build, then drive the panel with Playwright — assert the verified state appears, the tamper path fails, and an under-18 date is rejected at witness generation.
