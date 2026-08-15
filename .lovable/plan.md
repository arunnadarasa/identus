# Delegation credential demo on /learn

Add a hands-on demo where you issue a delegation credential to an AI agent, let the agent use it, and watch a verifier accept or reject the delegated action — all in the browser, no agent deployment needed.

## What the user does

1. **Set the mandate** — pick what the agent may do: a scope (e.g. `book:flight`), a spend cap (e.g. EUR 400), and an expiry (e.g. 24h). Two presets ("Book a flight", "Buy groceries") for quick starts.
2. **Issue** — click "Issue delegation credential". Alice's key signs a credential naming the agent as the subject, with the mandate as claims. The demo shows the decoded credential and the raw signed token.
3. **Agent acts** — the agent presents the credential alongside a proposed action (e.g. "book LHR→DUB, EUR 320").
4. **Verifier checks** — a step trace lights up one check at a time: signature valid, issuer is Alice, subject is this agent, scope covers the action, amount within cap, not expired, not revoked. Ends in a green **Accepted** or red **Rejected** state with the reason.
5. **Break it on purpose** — buttons to retry with: an over-cap amount, an out-of-scope action, an expired mandate, a tampered credential, and a revoked mandate. Each shows exactly which check fails and what a Web2 API key would have done instead (nothing — it would have gone through).

A short "what just happened" panel below ties each check back to the delegation chain hops already on the page.

## Where it goes

In the `#agents` section of `/learn`, directly after the "How delegation works" walkthrough — the walkthrough explains the hops, this demo lets you exercise them.

## Technical notes

- New component `src/components/learn/DelegationDemo.tsx` (client-only state machine, same visual language as `CredentialDemo.tsx` — Card, Badge, `TruncatedMono`/`shortenId` for DIDs and tokens).
- **Real signatures, not mocked**: generate an ECDSA P-256 keypair with WebCrypto on mount, sign a compact JWT-shaped credential (`iss` = Alice DID, `sub` = agent DID, `vc.credentialSubject` = scope/cap/expiry), and verify with `crypto.subtle.verify`. The tamper button flips a byte in the payload so the signature check genuinely fails.
- Business-rule checks (scope, cap, expiry, revocation) run over the decoded payload after signature verification, in the same order the trace displays.
- Demo DIDs are `did:prism:` style hex strings generated per session; no backend, no database, no Identus agent call — purely illustrative and labelled as such.
- Small step delays (~250ms) so the trace is readable; a "Run all checks" fast path too.
- Mobile: single column, sticky primary action, no horizontal overflow (`MonoValue` for long strings).
- `src/routes/learn.tsx`: import and render the component; add an "Agent delegation demo" entry to the section nav.
