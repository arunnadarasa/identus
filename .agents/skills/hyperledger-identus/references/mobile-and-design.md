# Mobile + design reference

## Token layer

The premium look lives entirely in `src/styles.css`:

- `oklch` palette (midnight indigo surfaces, indigo/violet primary with a `--primary-glow` companion), plus gradient and shadow tokens.
- Type: **Sora** for headings, **Manrope** for body, loaded via a `<link>` in `src/routes/__root.tsx` — never `@import` a remote URL from `styles.css` (Tailwind v4's Lightning CSS resolves `@import` from the filesystem).
- Utility classes for the glass panels and ambient glows; components compose those rather than inventing new gradients.

Components use semantic tokens only (`bg-card`, `text-muted-foreground`, `border-border`, `text-primary`). A hardcoded `text-white` / `bg-black` / `bg-[#…]` is a bug: it breaks the theme and the marketing/console consistency.

Shared building blocks: `SectionHeading`, `PremiumCard`, `MarketingHeader` (marketing pages), `AppShell` + `ModeBadge` (console), `StickyActionBar` (mobile forms).

## Long identifiers must never sit inline

DIDs, `0x` addresses, hashes and JWTs are 40-200 characters with no natural break points, so inline prose overflows the card at 390px.

Rules:

1. Use `shortenId(value)` / `TruncatedMono` from `src/components/MonoValue.tsx` for display.
2. In agentic demos, put them in the step's `values` array rather than the `detail` sentence:

```ts
push({
  label: "Mandate issued",
  actor: "human",
  detail: "The agent may spend up to 5 USDC on behalf of its principal.",
  values: [
    { label: "principal", value: mandate.humanDid },
    { label: "agent", value: mandate.agentDid },
  ],
  envelope: { claims: mandate.claims }, // full values live here
});
```

`TranscriptView` renders `values` as shortened mono rows; the untruncated value stays reachable in the raw envelope / `JsonBlock`.

3. Any free-text paragraph that can contain a machine identifier gets `break-words [overflow-wrap:anywhere]`.
4. Scrollable code/JSON containers get `min-w-0 max-w-full overflow-hidden` on their wrapper, or the horizontal scroll stretches the parent card past the viewport.

## Responsive header rule

Rows mixing text with fixed-size widgets:

```tsx
<header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
  <div className="flex min-w-0 items-center gap-3">
    <Icon className="h-5 w-5 shrink-0" />
    <h1 className="truncate text-xl font-semibold sm:text-2xl">{name}</h1>
  </div>
  <Widget />
</header>
```

`flex flex-wrap` alone collapses or clips on phones.

## Navigation

- Marketing routes (`/`, `/learn`, `/nhs`, `/docs`) all render `MarketingHeader`: inline links from `md:` up, a shadcn `Sheet` burger below, session-aware CTA ("Open console" vs "Sign in").
- Console header shows `ModeBadge` (simulated / docker / fly) as a color-coded pill so the active agent mode is never ambiguous.
- Mobile forms with a primary submit use `StickyActionBar` so the action stays reachable without scrolling.

## TypeScript gotcha

`exactOptionalPropertyTypes` is on. Optional props must be omitted, not set to `undefined`:

```ts
// wrong: Type 'undefined' is not assignable to '{ label: string; value: string }[]'
values: hash ? [{ label: "tx", value: hash }] : undefined,
// right
...(hash ? { values: [{ label: "tx", value: hash }] } : {}),
```
