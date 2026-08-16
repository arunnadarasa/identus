# Fix the ZK demo's Identus link and the Peer DID snippet

Two separate problems, both confirmed by looking at your live data.

## What is actually wrong

**1. The ZK panel has almost nothing to prove against.**
Your account has three credential records. Only one of them carries a credential JWT, and that one
carries the claims `goal` and `date` — no birth date. So the ZK picker shows a single credential in the
"No birth date" group and the real-credential path is effectively unusable; only manual entry works.
The other two records were never accepted, so they have no JWT at all and are correctly hidden.

**2. The JWT the proof binds to is always locally minted.**
The proof binds to the credential JWT, but that JWT is created by the app itself when you accept an
offer — never fetched from the Cloud Agent, even in Fly or Docker mode. Holder DID is also empty on
your records, so the JWT subject reads `did:prism:unknown` (the same string you saw in the x402
mandate line). The proof is genuine cryptography, but its Identus binding is weaker than the UI implies.

**3. The saved "Create a Peer DID" snippet in your sandbox is a stale copy.**
The template in the codebase was already fixed to read verification methods safely, but your saved
snippet still contains `resolved.verificationMethod.length` — hence `Cannot read properties of
undefined (reading 'length')` at line 22. "Reset starter snippets" replaces it, but nothing tells you
the saved copy is out of date.

## Changes

### ZK page — make the Identus path usable
- Add an **"Issue an age-provable demo credential"** action directly on the Zero-knowledge page. One
  click issues and accepts a credential carrying a `dob` claim (plus name and a schema of
  `StudentIDCredential`), then refreshes the picker and preselects it. This removes the dead end
  without a detour to the Credentials page.
- Show why hidden records are hidden: a small line such as "2 records not shown — never accepted, so
  they carry no credential JWT", with an Accept shortcut.
- Display the binding source on the proof panel: which credential, which issuer DID, whether the JWT
  came from the live agent or was simulated. No more implying agent provenance that is not there.

### Credential JWTs — bind to the real agent when there is one
- When accepting an offer in Fly or Docker mode, fetch the issued record from the agent
  (`/issue-credentials/records/{recordId}`) and store the agent's own signed JWT. Fall back to the
  simulated JWT only in simulated mode, or if the agent has not reached the issued state yet.
- Record which source was used so the ZK panel and the credential detail view can label it honestly.
- Default holder DID to a saved holder DID from your DIDs page instead of writing
  `did:prism:unknown`, so the JWT subject and downstream mandate checks refer to a real DID.

### Peer DID snippet
- Rewrite the template to be shape-agnostic: collect verification methods from whichever shape the SDK
  returns (`verificationMethods`, `coreProperties[].values`, or a top-level array), never index into a
  possibly-undefined field, and always print the resolved document so the real shape is visible.
- Print authentication and key-agreement counts separately, and note that the `initSync()` deprecation
  line is a harmless WASM warning.
- Add a starter version stamp: each starter snippet gets a template version, and the Sandbox shows
  "This snippet is an older copy of the starter — refresh it" with a one-click update when the saved
  code no longer matches the current template.

## Technical notes

- `src/components/zk/zk-proof-client-entry.tsx` — issue-demo-credential action, binding-source badge,
  hidden-record explanation.
- `src/lib/zk.functions.ts` — new server fn that issues + accepts an age-provable demo credential; also
  return the JWT source and hidden/unaccepted counts from `listZkCredentials`.
- `src/lib/identus.functions.ts` — `acceptCredential` pulls the agent's JWT for non-simulated modes and
  resolves a default holder DID; `issueCredential` unchanged apart from holder defaulting.
- `src/lib/identus/agent.server.ts` — helper to fetch an issued credential record from the agent.
- Migration: add `jwt_source` (text, nullable) to `credential_records`, and `template_version` (text,
  nullable) to `sprite_snippets`. No table creation, so existing grants and policies stand.
- `src/lib/sprites/snippets.ts` — rewritten Peer DID snippet plus a version constant per starter.
- `src/lib/sprites/sandbox.functions.ts` — record the template version on seed and reset; report which
  saved snippets are stale.
- `src/routes/app.sandbox.tsx` — stale-snippet notice and refresh action.
