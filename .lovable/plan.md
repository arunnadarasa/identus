# Plan: SSI Explainer Page for Non-Technical Audiences

## Goal

Add a new public content route (`/learn`) that explains Self-Sovereign Identity (SSI) and the opportunity it creates across web2 and web3, written for a non-technical reader. The page should be approachable, visually engaging, and consistent with the existing dark-theme design system.

## What to build

### 1. New route: `src/routes/learn.tsx`

A single, self-contained content route (same pattern as `docs.tsx`) with:

- **`createFileRoute("/learn")`** with full `head()` metadata (unique title, description, og:title, og:description, og:type=article, twitter:card).
- **Standalone header** matching the landing page's inline header pattern (`font-display` wordmark + nav links to `/docs`, `/learn` (active), and the console CTA), plus a footer identical to the landing page.

### 2. Page content sections (non-technical, analogy-driven)

Each section uses the existing component vocabulary (`Card`, `Badge`, `Button`, border-accent lists) and the `font-display` / `font-mono` type system.

1. **Hero** — A short, plain-language promise: "Identity you own and control" with a one-sentence definition of SSI and a CTA to scroll or jump to a section.

2. **"The problem today"** — Why current identity is broken, explained with everyday analogies (photocopying your passport to every shop; data breaches; account lockout). 3-card layout: *Passwords everywhere*, *You don't own your data*, *Breaches are inevitable*.

3. **"What SSI changes"** — The three pillars in plain English:
   - **You hold it** — credentials live in a wallet you control, not a company's database.
   - **You prove it** — show only what's needed (age over 18 without revealing birthdate).
   - **Anyone can verify** — a checker cryptographically confirms the credential without calling the issuer.

   Use a simple before/after comparison table (Today vs With SSI).

4. **"A day with SSI"** — A short narrative walkthrough: rent a flat, start a job, open a bank account — each step done by presenting a verifiable credential instead of emailing scans. 3–4 stepped cards with a numbered badge.

5. **The web2 opportunity** — How SSI upgrades web2 without breaking it:
   - Passwordless login backed by DID-based auth.
   - Privacy-preserving age/eligibility checks for regulated industries (gaming, alcohol, finance).
   - Reduce breach liability — no central vault of PII to steal.
   - Reusable KYC: verify once, present everywhere.
   - Presented as a 2×2 opportunity grid (feature + why it matters).

6. **The web3 opportunity** — Where SSI and web3 meet and where they differ:
   - DIDs as the identity layer blockchains don't provide natively.
   - Credentials for DAO membership, token-gating without doxxing, on-chain reputation.
   - Wallet convergence: one wallet holds keys, tokens, and credentials.
   - Honest framing: SSI doesn't require a blockchain, but blockchains make good trust anchors.
   - A small comparison table: *SSI alone vs SSI + web3*.

7. **"Where Identus fits"** — One plain paragraph + a compact card row: Identus gives you the open-source building blocks (DIDs, DIDComm, credentials) to actually ship this, and this app lets you try it live. CTA buttons: "Try the live demo" → `/auth`, "Read the primer" → `/docs`.

### 3. Navigation

- Add a **"Learn"** nav link to the landing page header (`src/routes/index.tsx`) next to **Docs**, linking to `/learn`.
- Add a **"Learn"** link to the docs page header (`src/routes/docs.tsx`) if it has the same header pattern.
- Add a secondary CTA on the landing hero: "What is SSI?" → `/learn`.

## Design constraints

- Reuse the existing dark-theme tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border/60`, `bg-card/60`, `text-primary`, `var(--gradient-hero)`). No hardcoded colors.
- Type: `font-display` for headings (Space Grotesk), `font-mono` for tags/badges, DM Sans (default) for body.
- Mobile-first: stacked single column on mobile, grid on `sm:`/`lg:`. Generous vertical rhythm (`py-14 sm:py-20`). No horizontal overflow.
- Fully static, client-only-safe: no server functions, no auth, no database reads. SSR-safe with zero imports of browser-only APIs.

## Out of scope

- No changes to `/app/*` console routes, agent logic, or backend.
- No new dependencies.
- No image generation unless a hero visual is explicitly requested later.

## Files to create / edit

| File | Action |
|---|---|
| `src/routes/learn.tsx` | **Create** — new explainer page |
| `src/routes/index.tsx` | **Edit** — add "Learn" nav link + "What is SSI?" CTA |
| `src/routes/docs.tsx` | **Edit** — add "Learn" nav link to header |
