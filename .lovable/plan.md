# Mobile burger menu on the homepage

The homepage header currently stacks all nav links (Learn, NHS, Docs, Open console, Sign out) into two wrapped rows on mobile, which eats vertical space above the hero.

## What changes

- On mobile (`< sm`), the header becomes a single row: wordmark on the left, a burger icon button on the right.
- Tapping the burger opens a slide-in panel with: Learn, NHS, Docs, and either "Open console" + "Sign out" (signed in) or "Open console" (signed out).
- Selecting an item closes the panel and navigates.
- On `sm` and up, the existing inline nav stays exactly as it is — no desktop change.

## Technical notes

- Edit `src/routes/index.tsx` only.
- Use the existing shadcn `Sheet` (`side="right"`) plus the `Menu` icon from `lucide-react`, matching the pattern already used in `src/components/AppShell.tsx` so the two headers feel identical.
- Sign-out keeps the current `handleSignOut` logic (cancel/clear queries, then redirect to `/auth`).
- Header row uses `grid-cols-[minmax(0,1fr)_auto]` on mobile so the wordmark truncates instead of pushing the button off-screen.
