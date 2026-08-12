# Mobile UX improvements

The console header currently wraps into three ragged rows on a phone (as in the screenshot), and several pages use desktop-first spacing, long mono strings and side-by-side rows that squeeze on narrow screens. This pass makes the app comfortable on a phone without changing any behaviour or backend logic.

## Navigation

- Replace the wrapping header with a single-row mobile bar: brand on the left, a compact menu button on the right.
- Tapping the menu opens a slide-in sheet with the five console links plus Docs, the signed-in email, and Sign out — each row a full-width, thumb-sized tap target with the active page highlighted.
- On tablet and up, keep today's inline nav row exactly as it is.
- Add a bottom-safe-area aware sticky header so it doesn't collide with the browser chrome.

## Page layout and spacing

- Tighten container padding on small screens (`px-4` on mobile, `px-6` from `sm:` up) across the console, landing page and docs, and reduce oversized vertical rhythm (hero and section padding) on phones.
- Scale headings down one step on mobile so titles like "Verifiable credentials" don't dominate the first screen.
- Convert header rows that mix a title with buttons/badges into the responsive grid pattern (`grid-cols-[minmax(0,1fr)_auto]` on mobile, flex from `sm:`) with `min-w-0` + `truncate`, so nothing clips.

## Cards, forms and long values

- Full-width, comfortably tall inputs, selects and primary buttons on mobile; action rows stack vertically instead of cramming side by side.
- DIDs, credential JWTs, Fly app names and API keys get proper truncation with copy buttons that stay reachable, instead of overflowing their cards.
- The Agents mode tab list becomes a full-width, evenly-split control so all three modes are tappable.
- The provisioning log viewer and code blocks get horizontal scroll containment on mobile so they never widen the page.

## Verification

Review the console, landing and docs pages at a 390px-wide viewport, checking the nav sheet, the credentials form, the agents page and the provisioning log for clipping or horizontal overflow.

## Technical notes

Changes are presentation-only: `src/components/AppShell.tsx` (new mobile nav sheet using the existing shadcn `sheet` component), plus Tailwind class adjustments in `src/routes/index.tsx`, `src/routes/docs.tsx`, `src/routes/app.*.tsx`, `src/components/FlyDeployPanel.tsx`, `src/components/AgentHealthPanel.tsx` and `src/components/ProvisionLogViewer.tsx`. No server functions, queries or database changes.
