# Clearer visuals for the /learn SSI explainer

Goal: a non-technical reader can skim the page and understand each section from a picture before reading any text.

## What gets added

1. **Triangle-of-trust diagram** (top, after the intro)
   Issuer → Holder → Verifier as three labelled nodes with arrows ("issues credential", "presents proof", "trusts issuer"). Responsive: triangle on desktop, vertical stack with down-arrows on mobile.

2. **"Today vs SSI" flow comparison** (Problem section)
   Two side-by-side mini-flows: today's path (You → Platform login → Platform holds data → Verifier phones platform) vs the SSI path (You hold credential → show proof → verifier checks maths). Colour-coded: muted/destructive tint for today, primary tint for SSI.

3. **Pillar icons + numbered rail** (Three pillars section)
   Each pillar gets an icon badge (wallet, seal, checkmark-shield) and a large step number so the three ideas read as a sequence rather than three paragraphs.

4. **Day-in-the-life timeline**
   Turn the existing list into a vertical timeline with connected dots, time-of-day labels, and small step icons, so the narrative reads as a journey.

5. **Before/after "data-exposure" bar visual**
   For the before/after items, add a simple visual showing "fields shared": today = full row of filled chips, SSI = one filled chip and the rest greyed, making selective disclosure instantly obvious.

6. **Web2 vs Web3 split panel**
   A two-column banner above the opportunity cards showing where each fits (Web2: logins, KYC, HR; Web3: wallets, DAOs, on-chain reputation), with a shared "same credential" element in the middle.

7. **Section navigation strip**
   Sticky-on-desktop mini nav ("Problem · Pillars · A day with SSI · Web2 · Web3") with anchor links, so long-form reading has orientation.

## Technical notes

- All diagrams built as small local presentational components inside `src/components/learn/` (e.g. `TrustTriangle.tsx`, `FlowCompare.tsx`, `SsiTimeline.tsx`, `DisclosureChips.tsx`, `Web2Web3Split.tsx`), pure CSS/SVG + Tailwind — no new dependencies, no images to generate.
- Colours use existing semantic tokens only (`primary`, `muted`, `border`, `card`, `destructive`); no hardcoded hex or `text-white`.
- Existing data arrays in `learn.tsx` (`problems`, `pillars`, `dayInLife`, `beforeAfter`, `web2Opportunities`, `web3Opportunities`) are reused; icons are added per item, text stays as-is unless a label is needed for a diagram node.
- Diagram SVGs get `aria-hidden` with a short adjacent text summary so the page stays accessible and screen-reader friendly.
- Mobile first: every diagram collapses to a single column stack; no horizontal scrolling.
- No backend, routing, or data changes; `/learn` head metadata unchanged.
