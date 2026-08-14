# Agentic opportunity section on /learn

Add a new section explaining why AI agents need verifiable identity, and how Identus/SSI plugs into the emerging agent protocol stack (A2A, AP2, UCP, x402).

## What the reader sees

New section "AI agents" placed after the Web3 section, before the FAQ, with:

**1. The framing (plain English)**
Agents are starting to act on our behalf — booking, buying, negotiating with other agents. Two questions become urgent: *who is this agent, and who does it act for?* and *is it allowed to do this?* Passwords and API keys can't answer either. DIDs and verifiable credentials can.

**2. A four-card protocol grid** — one card per protocol, each with a one-line "what it is" and a one-line "where SSI fits":

- **A2A (Agent-to-Agent)** — how agents discover each other and collaborate. SSI fit: each agent has its own DID, so identity and capability claims are portable and checkable instead of trusted by hostname.
- **AP2 (Agent Payments Protocol)** — lets an agent pay on a user's behalf with a signed mandate. SSI fit: the mandate is a verifiable credential — a scoped, expiring, revocable delegation instead of a stored card.
- **UCP (Universal Commerce Protocol)** — machine-readable commerce so agents can transact with merchants. SSI fit: merchant and buyer-agent credentials (KYB, age, entitlement) verified in-line, no account signup.
- **x402** — HTTP 402 pay-per-call access for machine clients. SSI fit: pair payment proof with a credential proof so a service can price *and* authorise a caller in one round trip.

**3. Delegation chain diagram** — a compact visual showing Human → Agent → Action:

```text
Alice (DID)
  │  issues delegation credential
  │  scope: book travel · limit EUR 500 · expires 30d
  ▼
Alice's agent (DID)
  │  presents proof + payment
  ▼
Airline / service  →  verifies issuer, scope, expiry, revocation
```

**4. "What an agent credential carries"** — small labelled chip row: `actsFor`, `scope`, `spendLimit`, `expiry`, `revocable`, each with a one-word gloss, showing that revoking one agent doesn't touch the human's other credentials.

**5. Concrete scenarios** — three short rows: agent buys a flight within a budget; agent proves the user is a verified customer without sharing the account; agent-to-agent negotiation where each side checks the other's issuer.

**6. Closing note + CTA** — one paragraph on why Identus is a fit (DIDs, VC issuance/verification, revocation already in the console) and a link to the console credentials page to issue a delegation-style credential today.

## Behaviour and style

- Reuses the page's existing look: outline badge, `font-display` heading, muted intro paragraph, `bg-card/60` cards with icon circles.
- Mobile-first: cards stack, diagram becomes vertical, no horizontal overflow.
- Purely presentational — no backend, no schema changes, no external calls.
- Protocol names are described in accessible terms; no claim that Identus implements them today, framed as where SSI fits.

## Technical notes

- New `src/components/learn/AgenticStack.tsx` — protocol grid + chip row.
- New `src/components/learn/DelegationChain.tsx` — the Human → Agent → Service visual.
- `src/routes/learn.tsx`: add `{ id: "agents", label: "AI agents" }` to `sectionNav` (after `web3`), and render `<section id="agents" className="scroll-mt-16">` between the Web3 and FAQ sections.
- Optionally add two FAQ entries ("Can an AI agent hold a credential?", "How do I stop an agent I no longer trust?") into the existing Verification/Credentials accordion groups.
- Semantic tokens only; no hardcoded colours.
