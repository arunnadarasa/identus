# ZK proofs bound to Identus credentials

The `/app/zk` console page proves a statement about a credential the console issued, without
revealing the credential or the underlying value. Prover mechanics live in the `noir-zk-browser`
skill; this card covers the Identus wiring only.

## Data flow

```text
credential_records (jwt, claims)
        │  listZkCredentials  (server fn, RLS-scoped)
        ▼
browser: extractBirthYear(claims) ──► dob_year        (private)
         credentialBinding(jwt)  ──► hash_lo/hash_hi  (private)
         verifier threshold      ──► threshold_year   (public)
        │  Noir + UltraHonk, entirely in-page
        ▼
{ proof, publicInputs, commitment }
        │  recordZkPresentation  (server fn)
        ▼
sim_presentations.zk_proof + activity_log
```

## Contracts

- `listZkCredentials` (`src/lib/zk.functions.ts`) filters to rows with a non-null `jwt`, and joins the
  most recent `sim_presentations.zk_proof.commitment` per credential as `lastCommitment`. A repeat
  proof of the same credential reproduces that commitment — this is how a verifier links two proofs
  to one credential without seeing it.
- `credentialBinding(jwt)` (`src/components/zk/zk-circuit.ts`) is WebCrypto SHA-256 split into two
  128-bit hex limbs (`hi` = first 32 hex chars, `lo` = remainder). Whole-digest fields overflow the
  BN254 field, hence the split.
- `recordZkPresentation` writes `state: "ZkPresentationVerified"`, `result: valid|invalid`, the
  commitment, public inputs, proof size, field count, elapsed ms, and the circuit source, then logs
  `presentation.zk_verified`.
- Credentials with no birth-date claim must be grouped as unusable in the picker with a route out
  ("manual entry" for an unbound demo, or a link to issue one with a `dob` claim). Never leave the
  Generate button disabled with no explanation.

## Honest framing

The proof shows: "the holder knows a credential whose SHA-256 commits to C, and its birth year is
at or before the threshold." It does **not** verify the issuer's signature inside the circuit — the
JWT signature is checked outside it. Say so in the UI rather than implying full in-circuit
credential verification.

## Loading contract (progress, timeouts, retry)

`src/components/zk/zk-proof-client-entry.tsx` treats prover loading as a first-class, failure-prone
step:

- Progress is `{ phase, assets, bytes }` — the phase name is shown to the user ("fetching modules",
  "compiling circuit", "proving") and byte/asset counts come from the fetch hooks, so a multi-MB WASM
  download reads as movement rather than a hang.
- Each phase has its own timeout that throws `StageTimeoutError`. The failed stage is recorded as
  `load` / `load-timeout` / `prove` / `prove-timeout` and drives a tailored message: network advice
  for load failures, "try a desktop browser" for slow proving.
- Every failure state offers "Reload the prover and retry" — never a dead end.
- The Noir compiler is served as a verbatim vendor asset and imported with `@vite-ignore` to avoid a
  temporal-dead-zone crash from bundler hoisting (see the `noir-zk-browser` skill).

