# Same burger menu on every public page

Right now only the landing page has the mobile burger menu. `/learn`, `/nhs`, and `/docs` still render the full row of links (Learn · NHS · Docs · Open console), which squeezes the wordmark down to "Ident…" and crowds the top of the screen on a phone — exactly what the screenshots show.

## What changes

Pull the landing page's header into one shared component and use it on all four public pages, so mobile always shows: wordmark on the left, a single burger button on the right.

- Desktop (`sm` and up): unchanged — the same inline links, GitHub icon, and "Open console" button.
- Mobile: wordmark plus one burger button. Tapping it slides in the same panel already used on the landing page, with Learn, NHS, Docs, GitHub, "Open console", and "Sign out" when signed in.
- The wordmark stops truncating on mobile, since the links no longer compete for space.
- Every page gets the GitHub link and the session-aware console/sign-out behaviour that only the landing page has today.
- The console's own header (`/app/*`) is untouched — it already has its own mobile menu and mode badge.

## Technical notes

- New `src/components/MarketingHeader.tsx`: the landing page's current header markup (grid `minmax(0,1fr)_auto` on mobile, `sm:flex`, desktop `nav` hidden below `sm`, shadcn `Sheet` trigger with `sm:hidden`), holding its own `menuOpen` state, session read, and sign-out handler so each page just renders `<MarketingHeader />`.
- Replace the header block in `src/routes/index.tsx`, `src/routes/learn.tsx`, `src/routes/nhs.tsx`, and `src/routes/docs.tsx` with the shared component; drop the now-unused `Sheet`/`Menu` imports and menu state from `index.tsx`.
- Header width is currently `max-w-6xl` on the landing page and `max-w-5xl` elsewhere; the component takes a `maxWidth` prop so each page keeps its existing container width.
- Verify at a 390px-wide viewport with Playwright that no page header overflows horizontally and that the burger opens the panel.
