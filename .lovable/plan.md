# Agent-to-agent use case cards

Add four concrete use case cards to the AI agents section of `/learn`, one per protocol (A2A, AP2, UCP, x402), each with a short sample flow that highlights exactly where delegation and credential checks fit.

## What the user sees

A new "Use cases" block under "The delegation chain", with four expandable cards:

- **A2A — travel booking negotiation.** Your agent talks to an airline's agent. Sample flow: discover agent card → exchange DIDs → each verifies the other's issuer → negotiate fare → hand off to payment. Delegation point: the buyer agent presents a delegation credential naming its principal and scope before any offer is accepted.
- **AP2 — mandated purchase.** Your agent buys within a budget. Flow: user signs a mandate (cap, merchant class, expiry) → agent shops → merchant verifies mandate signature and freshness → charge within cap. Delegation point: the signed mandate is the delegation, verifiable without contacting you.
- **UCP — commerce capability discovery.** Agent reads a merchant's capability manifest, checks which actions it is authorised to invoke, then calls a checkout capability. Delegation point: capability scope intersected with the agent's delegated scope decides what it may call.
- **x402 — pay-per-call resource.** Agent hits a paid endpoint, gets HTTP 402 with price and address, pays on Base Sepolia, retries with proof of payment. Delegation point: the spend is bounded by the AP2 mandate the agent holds; the resource can additionally require a credential presentation.

Each card shows: the actors, a numbered 4–5 step flow, a highlighted "where delegation fits" line, what breaks without SSI, and a link to the matching live demo in the console (`/app/demos`).

Cards are collapsed to title + one-line summary on mobile and expand on tap; on desktop they render as a two-column grid with flows visible.

## Technical notes

- New component `src/components/learn/AgenticUseCases.tsx` holding the four cards as a local data array plus a small presentational card; uses existing shadcn `Card`, `Badge`, `Accordion`/`Collapsible` and semantic tokens only (no hardcoded colors).
- Insert into `src/routes/learn.tsx` inside the existing `#agents` section, between the delegation chain block and "What this unlocks"; keep the existing copy intact.
- No backend, route, or demo-logic changes; links point at the already-built `/app/demos` page.
