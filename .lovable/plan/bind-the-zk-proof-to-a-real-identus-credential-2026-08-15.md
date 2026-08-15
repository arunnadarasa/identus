# Bind the ZK proof to a real Identus credential

## Current state

The `/app/zk` demo is genuine zero-knowledge (Noir circuit compiled in-browser, UltraHonk proof, in-browser verification), but it is **standalone**: the birth year is typed into an input, and nothing touches an issued credential, a DID, or the agent. So the honest answer to "was Identus involved?" today is no.

## What to build

Make the proof provably about a credential the console issued, not about a number the user typed.

### 1. Credential-sourced input

Add a credential picker at the top of the ZK page listing the signed-in user's issued credentials (state `CredentialReceived`, with a JWT). Selecting one:

- pulls the birth year from the credential claims (`dob`, `dateOfBirth`, or `birthYear` — whichever the schema used)
- locks the year field to that value and shows the issuer DID, schema, and subject alongside it
- keeps a "manual entry" escape hatch for when no suitable credential exists

If the selected credential has no date-of-birth-style claim, say so and point at the credentials page.

### 2. Bind the credential to the proof

Extend the Noir circuit so the proof commits to the credential, not just the year:

- new private input: the birth year (as today)
- new private input: a credential binding value derived in the browser from the credential JWT
- new public inputs: the age threshold year (as today) plus a public hash of that binding

The circuit asserts both `dob_year <= threshold_year` and that the private binding hashes to the public commitment. A verifier then learns "this proof is about credential X and its holder clears the threshold" while still never seeing the birth year.

### 3. Present the proof as an Identus presentation

After a successful proof, offer "Record as presentation" which stores a presentation row against the credential (verifier DID = the active agent's DID, proof metadata + public inputs attached) and writes an activity-log entry. That makes the ZK run visible in the console's activity feed next to the JWT-VC presentations, so the two layers sit side by side.

### 4. Rewrite the explanatory copy

The current callout says Identus presentations are a separate layer. Replace it with an accurate description of the new split: the credential and its issuer come from Identus, the age predicate is proved by Noir, and the binding is what links them. Keep the caveat that this is a proof *about* a JWT credential rather than a natively ZK credential format (AnonCreds/BBS+), since the JWT signature itself is not verified inside the circuit.

## Technical notes

- `src/components/zk/zk-circuit.ts` — add the binding inputs to `AGE_CIRCUIT_SOURCE` and bump the Nargo package; keep the source small so in-browser compile stays fast.
- `src/components/zk/ZkProofLive.tsx` — credential picker, claim extraction, binding derivation (WebCrypto SHA-256 over the JWT, folded into a field element), extra proof steps in the existing step list.
- `src/lib/identus.functions.ts` — a server function returning the user's ZK-eligible credentials (id, schema, subject, issuer DID, the relevant claim), plus one to record a ZK presentation into `sim_presentations` with the proof metadata.
- `src/routes/app.zk.tsx` — mount the picker, update head/copy.
- No migration needed if proof metadata goes into the existing presentation row's JSON-ish columns; if not, add a nullable `zk_proof` jsonb column with the usual grants and RLS.
- The vendored Noir compiler load path at `/vendor/noir_wasm/main.mjs` stays as-is — circuit changes are source-level only.

## Out of scope

Verifying the credential's issuer signature inside the circuit (needs AnonCreds or BBS+ credential formats, not JWT-VC).
