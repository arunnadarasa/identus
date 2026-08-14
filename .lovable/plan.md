# Add a zero-knowledge proof (ZKP) opportunity section to /learn

## Context
The `/learn` page already covers web2, web3, and AI-agent opportunities for SSI. It mentions selective disclosure in passing ("prove you're over 18 without revealing your birthdate") but never explains the technology that makes that possible — zero-knowledge proofs. The user wants a dedicated section that explains ZKPs in plain English and shows the opportunity, matching the style of the existing opportunity sections.

## What to build

### 1. New component: `src/components/learn/ZkProof.tsx`
A presentational component (no server logic) with three parts:

- **Plain-English explainer** — what a ZKP is: "prove a statement is true without revealing why it's true." Use the colour-matching analogy (proving two balls are different colours without showing which is which) or the "prove membership without showing the card" framing, consistent with the page's non-technical tone.

- **Interactive proof comparison** — a small toggle showing the same scenario two ways:
  - *With a standard credential*: reveal the full record (name, DOB, nationality) to prove "over 18"
  - *With a ZK proof*: reveal only "over 18 = true" and a cryptographic proof — nothing else
  Reuse the chip pattern from `DisclosureChips.tsx` for visual consistency, but make the ZK side show a single proof chip plus a green "verified" check, emphasising nothing else leaves the wallet.

- **Opportunity grid** — 3 cards (matching `web3Opportunities` card style) covering:
  - **Prove one fact** — age, income threshold, membership, without the document
  - **Private compliance** — prove KYC/accreditation status without exposing the underlying PII
  - **Unlinkable verification** — the same proof can't be correlated across verifiers (no shared nonce), contrasted with today's "show the same ID everywhere"

### 2. Section in `src/routes/learn.tsx`
Insert a new `<section id="zk">` between the **Web3 opportunity** section (ends ~line 640) and the **AI agents** section (starts ~line 643).

- Badge: "The zero-knowledge opportunity"
- Heading: "Prove it without showing it"
- Intro paragraph connecting selective disclosure (already mentioned) to the cryptography behind it
- Render `<ZkProof />`
- Honest note: Identus supports ZK-proof-based credential presentations (AnonCreds / BBS+); the live console demo uses JWT-VC, which does selective disclosure but not full ZK proofs — say this plainly.

### 3. Nav entry
Add `{ id: "zk", label: "Zero-knowledge" }` to the `sectionNav` array, positioned between "web3" and "agents".

### 4. Import
Add `import { ZkProof } from "@/components/learn/ZkProof";` to the imports block.

## Not changing
- No server functions, no database, no Identus agent calls — purely presentational.
- Existing sections, copy, and components stay untouched.
- Head metadata is already complete for `/learn`.
