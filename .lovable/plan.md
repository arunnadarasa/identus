# "How delegation works" step-by-step explainer

Turn the static three-box delegation chain on `/learn` into a guided walkthrough that advances one hop at a time and explains each hop in plain English.

## What the user sees

A new panel in the "AI agents need identity too" section, directly around the delegation chain visual:

- **Step counter and title** — e.g. "Step 2 of 5 · The agent gets a narrow permission".
- **The chain visual, progressively lit** — hops appear dimmed until the walkthrough reaches them; the active hop is highlighted, completed hops get a check.
- **A plain-English card per step** answering three things:
  - *What happens* (one or two sentences, no jargon)
  - *Why it matters* (what could go wrong without it)
  - *What's actually checked* (issuer, scope, limit, expiry, revocation) shown as small chips
- **Controls** — Back / Next, a Restart, and clickable step dots so users can jump around. Keyboard arrow keys work too.

## The five steps

1. **Alice has a wallet and an identity** — a DID she controls, not an account someone else owns.
2. **Alice writes the permission** — issues a delegation credential to her agent: scope "book travel", limit EUR 500, expires in 30 days.
3. **The agent holds the permission** — it never holds Alice's password or card; it holds a signed, narrow, expiring badge.
4. **The agent acts and presents proof** — when it books, it shows the delegation plus its own DID, and reveals only the fields needed.
5. **The airline verifies before accepting** — checks signature, issuer, scope, limit, expiry and revocation; anything out of bounds is refused.

Each step also gets a short "if this were web2 instead" line (shared password, unlimited API key, no audit trail) so the contrast is obvious.

## Behaviour and layout

- Static-first: all step text is rendered in the DOM so it stays readable and indexable even before interaction; the walkthrough controls only change emphasis.
- Mobile: single column, chain hops stack, controls pinned inside the card so Back/Next stay reachable without scrolling.
- No new data, no backend calls, no dependencies.

## Technical notes

- New component `src/components/learn/DelegationWalkthrough.tsx` holding the step data and the active-step state.
- Refactor `src/components/learn/DelegationChain.tsx` to accept optional `activeIndex` / `completedThrough` props so the same visual can be reused by the walkthrough; existing static usage keeps working with no props.
- `src/routes/learn.tsx`: replace the current "The delegation chain" block's static visual with the walkthrough component (keeps the same heading and intro copy, keeps the `#agents` anchor).
- Uses existing design tokens and shadcn primitives (Button, Badge, Card) only — no hardcoded colors.
