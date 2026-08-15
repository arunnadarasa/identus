# Fix: x402 gate rejects a valid mandate ("wrong_subject")

## What is happening

The demo mints a correct mandate — "Shopping agent may spend up to 0.50 USDC **on behalf of** did:prism:ae320c…" — and then the gate rejects it with:

> Mandate was issued to did:prism:demo-shopping-agent-000…, but the payer presented as did:prism:ae320c…

Both DIDs are correct. The gate is comparing the wrong two of them.

- The eligibility credential (StudentID) is held by the **human**: `did:prism:ae320c…`
- The delegation mandate is issued **to the agent**: `did:prism:demo-shopping-agent-…`, with `actsFor = did:prism:ae320c…` (the human)

The coverage check compares the mandate's *subject* (the agent) against the eligibility credential's *subject* (the human), so a perfectly formed delegation can never pass. The right invariant is: **the mandate's `actsFor` must equal the human who presented the eligibility credential.**

A second, related problem: the mandate issuer picks the agent DID as "any holder DID that isn't the human", which never matches when the console has one holder DID, so every mandate falls back to the hardcoded `did:prism:demo-shopping-agent-…` placeholder.

## The fix

1. **Correct the invariant in the gate** (`src/lib/agentic/x402-mandate.ts`)
   - Rename the check input from `expectedSubject` to `expectedPrincipal` (the human from the eligibility credential) and compare it against `mandate.actsFor`, not `mandate.agentDid`.
   - Failure becomes a clearer outcome, `wrong_principal`, with a message naming both roles: "Mandate acts for X, but the eligibility credential was presented by Y."
   - Keep the existing wallet-binding, scope, merchant, expiry and spend-cap checks unchanged; keep `wrong_subject` for the wallet mismatch case.
   - Add an optional `expectedAgent` check so a caller that knows the agent DID can still assert the mandate was issued to that agent.

2. **Pass the right value from the proxy** (`src/routes/api/public/x402-proxy.ts`)
   - Send the eligibility credential's subject as `expectedPrincipal`.
   - Read an optional agent DID header and forward it as `expectedAgent`, so the agent identity is verified as its own dimension rather than confused with the human's.
   - Include both `actsFor` and `agentDid` in the gate trace so the raw envelope shows which DID played which role.

3. **Give the agent a real DID** (`src/lib/agentic/x402.functions.ts`)
   - Pick the agent DID by intent instead of "not the human": prefer a saved DID whose role/alias marks it as the agent (alias containing "agent"), then any second holder DID, then the demo placeholder — and return a flag saying whether it was a real console DID or the placeholder.
   - Keep `actsFor` as the human holder DID (unchanged, already correct).

4. **Make the demo trace legible** (`src/routes/app.demos.x402.tsx`)
   - Send the agent DID with the paid request so the gate can assert it.
   - In the "mandate issued" step, label the three DIDs explicitly (issuer / agent subject / acts for) and note when the agent DID is a demo placeholder because the console has no dedicated agent DID.
   - Add a "wrong principal" option to the existing tamper control so the failure path stays demonstrable on purpose rather than by accident.

## Verification

- Run the happy path end-to-end: credential accepted → member price → mandate issued → EIP-3009 signed → gate forwards → settled on Base Sepolia.
- Re-check the deliberate failure paths still reject: low spend cap, scope removed, wrong merchant, expired mandate, tampered principal.

## Technical notes

No database or schema changes. Changes are confined to four files: the mandate checker, the public x402 proxy route, the mandate-issuing server function, and the demo page.
