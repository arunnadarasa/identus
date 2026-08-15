# Join Identus to the x402 settlement demo

Today the x402 demo is pure payment: `app.demos.x402.tsx` → `api/public/x402-proxy.ts` →
`lib/agentic/x402.ts` do the 402 challenge, EIP-3009 authorization and Base Sepolia settlement with no
DID, credential or delegation check anywhere. Credential logic lives only in the sibling demos
(`lib/agentic/negotiation.server.ts`, `credentials.server.ts`). This joins the two halves: an Identus
credential unlocks the price, and a delegation mandate authorises the spend.

## Honest constraint

The upstream PayAI facilitator quotes a fixed testnet price (0.01 USDC) and we cannot make it discount.
So the credential/delegation logic lives in our own same-origin gate, which sits in front of the
facilitator. The UI will state plainly which numbers are our gate's policy quote and which is the
amount actually settled on Base Sepolia — no pretending the chain saw the discount.

## What gets built

### 1. An Identus-aware gate in front of the facilitator

`api/public/x402-proxy.ts` becomes a gate with three outcomes on the initial request:

- **No credential presented** → HTTP 402 with the *list* price tier and
  `error: "credential_required"`, naming the credential type it will accept. The payment is not
  forwarded upstream.
- **Valid eligibility credential** → 402 re-quote at the *member* price tier, plus the verification
  trace (issuer DID, credential type, expiry).
- **Payment retry** → the delegation check below runs before anything is forwarded.

Credential and mandate arrive in request headers alongside `PAYMENT-SIGNATURE`
(`X-Identus-Credential`, `X-Identus-Delegation`), so the existing v2 envelope handling is untouched.

### 2. Delegation-bound payment

Before forwarding a signed authorization, the gate verifies the delegation credential covers the
attempted spend:

- `actsFor` present and the credential subject matches the paying wallet/agent DID
- `scope` includes the payment action
- `spendLimit` >= the authorization amount (compared in atomic units)
- `validUntil` not passed, merchant/`payTo` allowed

Any failure returns 403 with a machine-readable reason (`over_spend_limit`, `mandate_expired`,
`scope_not_granted`, `wrong_subject`) and the flow log shows it verbatim. Only a covered payment is
forwarded to the facilitator.

Verification reuses `verifyCredentialJwt` from `negotiation.server.ts` (issuer/type/expiry structural
checks) and adds mandate-coverage checks in a new `lib/agentic/x402-mandate.ts` so both the gate and
the UI can reason about the same rules.

### 3. Demo UI: two new steps before payment

`app.demos.x402.tsx` grows from 4 flow steps to 6:

1. **Challenge (unauthenticated)** — shows the 402 asking for a credential, at list price.
2. **Present credential** — mints/loads the eligibility VC from the active Identus agent
   (`credentials.server.ts`; falls back to the clearly-labelled demo JWT when no agent is active) and
   re-fetches the challenge → member price, with the issuer DID shown.
3. **Delegation mandate** — an editable mandate card (agent name, scope, spend cap, expiry) issued as
   a delegation credential; shows what the gate will check.
4. **Sign** — unchanged EIP-3009 authorization.
5. **Retry with credential + mandate** — gate verifies, then forwards.
6. **Settle** — unchanged `PAYMENT-RESPONSE` receipt and BaseScan link.

Two tamper affordances so the gate is visibly real: **lower the spend cap below the price** (expect
`over_spend_limit`) and **drop the credential** (expect `credential_required`). Both keep the wallet
from spending anything.

A short explainer panel at the top states the split: x402 answers "can it pay", Identus answers "who
is it and who authorised it" — with a link across to the AP2/UCP demos and `/learn`.

## Technical notes

- Files: `src/routes/api/public/x402-proxy.ts` (gate), new `src/lib/agentic/x402-mandate.ts`
  (shared coverage rules + price tiers), `src/lib/agentic/x402.ts` (send the two new headers, surface
  gate reasons), `src/routes/app.demos.x402.tsx` (steps, mandate card, tamper buttons), and a small
  server fn in `src/lib/agentic/a2a.functions.ts`-style wrapper to mint the two credentials.
- The gate stays under `/api/public/*` (no auth gate) and keeps its CORS/`PAYMENT-RESPONSE`
  passthrough, v2 envelope shape, CAIP-2 network id and `amount` field exactly as now.
- No new secrets, no schema change. Simulated-agent mode still runs the whole flow, with the
  credential badged as demo-signed rather than cryptographically verified.
- Mobile: the mandate card and flow log follow the existing `MonoValue` truncation and
  `StickyActionBar` patterns so long DIDs and hashes don't overflow.
