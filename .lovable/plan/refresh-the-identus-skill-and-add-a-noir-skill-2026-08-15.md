# Refresh the Identus skill and add a Noir skill

Two skills, both authored as drafts under `.agents/skills/` and then activated.

## 1. Update `hyperledger-identus`

The existing skill still describes the console as it was before the zero-knowledge page, the agentic demos, and the issuer-DID work landed. Additions and corrections:

- **New surfaces in the file map**: the `/app/zk` console route, `src/lib/zk.functions.ts`, `src/lib/zk-claims.ts`, the agentic demo library and public API routes (`src/lib/agentic/*`, `src/routes/api/public/*`), and the marketing pages (`/learn`, `/nhs`, shared `MarketingHeader`).
- **Issuer DID rules**, currently missing and the source of repeated 400s: only a published `did:prism` with an `assertionMethod` key can sign a credential offer; `listIssuerDids` filters on resolver capabilities and `issueCredential` pre-flights it. Authentication-only DIDs must be labelled, not offered.
- **Connectionless issuance**: when no DIDComm connection exists, offers go out with an invitation URL rather than a `connectionId`; the holder is the mandate/credential subject, the agent is a separate DID.
- **Credential claims contract**: the ZK age proof needs a date-of-birth claim (`dob`, `dateOfBirth`, `birthDate`, `birthYear` and snake_case variants) — credentials issued without one cannot be used, so issuance templates include `dob`.
- **New invariants**: public IP allocation is required for a Fly app to be reachable; Fly readiness polls are capped at 60s per call to avoid API 400s; orphaned Fly connections must degrade gracefully on 404.
- **New workflow**: "Bind a zero-knowledge proof to an issued credential" — pick a credential with a birth claim, derive the JWT binding in the browser, prove, and record the presentation.
- Two extra reference cards: `credential-issuance.md` (issuer DID capability rules, connectionless flow, claim conventions) and `zk-integration.md` (how the console wires Identus credentials to the Noir prover).

## 2. New skill: `noir-zk-browser`

A skill for browser-side zero-knowledge proofs with Noir plus the Barretenberg UltraHonk prover in a Lovable/TanStack Start app — the parts that are painful to rediscover.

Contents:

- **Packages and pinned versions** actually used here: `@noir-lang/noir_wasm`, `@noir-lang/noir_js`, `@aztec/bb.js`.
- **The two bundler traps, with the fixes**: `optimizeDeps.exclude` for all three packages (esbuild's dep optimizer mangles the bindgen glue and WASM instantiation hangs silently), and serving `noir_wasm`'s published `web/main.mjs` verbatim as a vendor asset loaded via `import(/* @vite-ignore */ url)` — because Rolldown rewrites the vendored `@ltd/j-toml` globals into `const Infinity = Infinity`, producing "Cannot access 'j' before initialization" in production only.
- **Threading**: `Barretenberg.new({ threads: 1 })` works without cross-origin isolation headers; multi-threaded proving needs COOP/COEP.
- **Circuit authoring**: compiling from source in the browser with `createFileManager` plus an inline `Nargo.toml`, private vs `pub` inputs, returning a Pedersen commitment so a verifier can identify what was proved without seeing it, and field-limb encoding for a SHA-256 digest (two 128-bit halves).
- **UX budget**: real timeout figures per phase (load 90s, witness 30s, prove 180s, verify 60s), tracking real download bytes with a `PerformanceObserver` because the WASM is fetched internally, and session reuse plus teardown on failure.
- **Failure-mode table**: silent hang, TDZ error, wasm memory errors, verification false, missing browser APIs during SSR.
- Reference cards: `bundler-config.md` (the full Vite plugin and why each line exists) and `circuit-patterns.md` (circuit snippets: range checks, commitments, hash binding, Merkle membership sketch).

## Technical notes

- Draft locations: `.agents/skills/hyperledger-identus/` (edit in place, add two reference files) and `.agents/skills/noir-zk-browser/SKILL.md` plus its `references/`.
- Both are activated with the skill apply step after writing; no application code changes.
- Frontmatter descriptions carry explicit trigger words ("noir", "zero-knowledge proof", "ultrahonk", "bb.js", "zk circuit") so the right skill loads.
