# Premium redesign: Midnight Indigo

A full visual upgrade — new token set, new typography, a split-screen hero, and tasteful motion — applied across the marketing pages and the console shell.

## Direction

- **Palette: Midnight Indigo.** Near-black navy canvas (`#0a0a1a`), raised navy surfaces (`#141432`), indigo edges (`#1e1e5a`), electric indigo primary (`#4f46e5`) with a lighter indigo glow for gradients. Teal is retired as the primary; success/warning/destructive stay semantic so status badges keep meaning.
- **Typography: Sora headings + Manrope body.** Loaded via the root route's font `<link>` (replacing Space Grotesk / DM Sans). JetBrains Mono stays for DIDs, JWTs and code.
- **Layout: split-screen hero.** Left column carries the claim and actions; right column carries a live-looking artifact (credential card → ZK proof → delegation chain) instead of a decorative blob.

## What changes

**1. Design tokens (`src/styles.css`)**
- Rewrite `:root` / `.dark` colour values in oklch to the Midnight Indigo scale; deepen background, lift card/popover a step so glass surfaces read.
- Add premium tokens: `--gradient-hero`, `--gradient-primary`, `--glow-primary`, `--shadow-elegant`, `--shadow-float`, `--border-subtle`, plus a `--radius` bump to 0.75rem.
- Register the new tokens in `@theme inline` so they are usable as utilities; add `@utility glass`, `@utility glow-ring` and `@utility text-gradient` rather than hardcoding colours in components.

**2. Marketing surface**
- `src/routes/index.tsx`: split-screen hero with an animated credential/proof artifact panel, gradient headline, sharper section rhythm, and elevated feature cards with hover lift and glow.
- `MarketingHeader.tsx`: slimmer glass header that gains a border and blur on scroll; burger menu behaviour kept as-is.
- `/learn`, `/nhs`, `/docs`: adopt the same section shell, heading scale, card treatment and eyebrow labels so the set feels like one product.
- Add a shared `SectionHeading` and `PremiumCard` presentation component so the styling is defined once.

**3. Console shell**
- `AppShell.tsx`: refined sidebar/top bar with the new surfaces, active-route indicator, and a restyled `ModeBadge`.
- Panels and cards across `/app/*` inherit the token changes; targeted polish on the agent, credentials and ZK panels (spacing, headers, mono value treatment) without touching their logic.

**4. Motion**
- Entrance reveals on hero and section blocks, hover lift on cards, a subtle animated gradient on the hero artifact — all CSS/keyframes and `tw-animate-css`, respecting `prefers-reduced-motion`. No new animation dependency.

## Notes

- Presentation only: no server functions, Fly/agent logic, ZK circuits or database changes.
- Contrast is checked against the dark canvas for body text, muted text and badges.
- Because tokens are semantic, the console picks up the new look without per-component colour edits; any stray hardcoded colour utilities found along the way get swapped to tokens.
