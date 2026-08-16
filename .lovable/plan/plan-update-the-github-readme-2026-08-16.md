# Plan: Update the GitHub README

The README is comprehensive but stale in five areas that changed in recent work. This is a targeted update, not a rewrite — the overall structure and sections stay.

## What's outdated

1. **ZK demo moved to the console.** The README says the live ZK proof lives at `/learn#zk` (line 295). It now lives at `/app/zk` in the console. The `/learn` page still has a conceptual ZK section, but the interactive proof is in the console.

2. **ZK is now bound to real Identus credentials.** The README's "honest framing" paragraph (line 304) and the roadmap item (line 336) both say credential-bound ZK presentations are "not wired into the console yet." They now are: `listZkCredentials` fetches real signed JWTs from `credential_records`, the Noir circuit binds the proof to a SHA-256 commitment of the credential's JWT, and completed proofs are recorded as presentations via `recordZkPresentation`. The honest framing should shift from "not wired" to "bound via commitment, not native ZK credential format."

3. **SDK Quickstart panel is new.** The sandbox now has a copy-paste delegation-credential quickstart (`SdkQuickstartPanel.tsx` / `delegation-snippets.ts`) with Install, Issue, Verify, and Gate tabs. Not mentioned in the README.

4. **Sandbox snippet versioning is new.** Starter snippets carry version stamps; saved copies that fall behind are flagged as stale in the list and editor; per-snippet refresh and reset-all are available. Not mentioned.

5. **x402 has an Identus credential gate.** The x402 demo description (line 317) mentions the payment flow but not the Identus gate: a `StudentIDCredential` check plus an `AgentDelegationCredential` mandate that scopes which agent can pay, with principal-vs-agent distinction. The README should mention this.

## Edits to make

### Console routes table (lines 62-71)
- Add a `/app/zk` row: "Live in-browser ZK proof. Pick a console-issued credential, prove an age threshold over its birth-year claim, bound to the credential's JWT via a SHA-256 commitment. Records the proof as a presentation."

### Zero-knowledge proof demo section (lines 293-304)
- Change the route reference from `/learn#zk` to `/app/zk`.
- Add a bullet about the Identus binding: the circuit takes a private `dob_year` extracted from a real console-issued credential's claims, plus a SHA-256 commitment to that credential's JWT as a public binding input, so a verifier can confirm which credential was used without seeing it.
- Add a bullet about `listZkCredentials` / `recordZkPresentation` — proofs are recorded against the credential in `sim_presentations` and surfaced in the activity log.
- Rewrite the "honest framing" paragraph: the proof is genuinely zero-knowledge and now bound to a real Identus-issued JWT via a commitment, but the binding is a hash commitment, not a native in-circuit signature proof. AnonCreds/BBS+ would let the issuer's signature itself be proven; until Identus ships one, the commitment binding is the practical join.

### Agentic commerce demos — x402 row (line 317)
- Add that the x402 proxy enforces an Identus gate: requires a `StudentIDCredential` and an `AgentDelegationCredential` mandate scoped to `payment:x402`, with principal-vs-agent DID verification. The gate policy quote (list/member tiers in USDC) is the app's own; the amount settled on Base Sepolia is the facilitator's requirement.

### Sandbox description (line 69)
- Add that the sandbox now includes a **Quickstart — delegation credentials** panel with copy-paste Install/Issue/Verify/Gate snippets (WebCrypto ES256, runnable in-browser and in the sandbox), and that starter SDK snippets are version-stamped with stale detection and per-snippet refresh.

### Project structure (lines 126-169)
- Add `app.zk.tsx` to the routes list.
- Add `zk.functions.ts` and `zk-claims.ts` to the lib list.
- Add `delegation-snippets.ts` to the sprites lib list.
- Add `SdkQuickstartPanel.tsx` to the components list.
- Add `zk/` to the components list (ZkProofLive, zk-proof-client-entry).

### Data model (lines 275-288)
- `credential_records`: add `jwt_source` column (tracks whether the stored JWT came from the real agent or a simulated signature).
- `sprite_snippets`: add `template_version` column (drives stale detection).

### Roadmap (lines 335-340)
- Change the ZK roadmap item from "not wired into the console yet" to: "ZK proofs are bound to real credentials via a SHA-256 commitment, but the issuer's signature is not proven in-circuit — a native ZK credential format (AnonCreds/BBS+) would close that gap."
- Add: "Sandbox starter snippets are version-tracked but there is no auto-migration of custom edits when a template changes — stale copies are flagged and can be refreshed manually."

## No other changes
- Top-level structure, feature tour intro, architecture diagram, Fly section, Docker section, security notes, environment variables, contributing, and links sections are all still accurate and need no edits.
