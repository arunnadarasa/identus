# Mobile UX polish for the console

The flows now work end to end on a real Fly agent. The remaining problems are presentation on a phone: the page can be dragged sideways, long machine-generated strings (DIDs, JWTs, invitation URLs) dominate the screen, and success toasts cover the content they refer to.

## What changes

### 1. Stop the sideways drag
Two screenshots show the page pushed left with the header cut off — something inside a card is wider than the viewport. Lock the app shell and page containers so nothing can exceed the screen width, and make the offending long-string blocks shrink instead of pushing.

### 2. Tame long identifiers
- Issuer DID / connection selects: show a shortened, readable form (`did:prism:4e30…81b5`) instead of a clipped raw string, with the full value still available in the dropdown row.
- JWT block: collapse to two lines by default with a "Show full / Copy" pair, instead of a 200-character wall.
- Invitation URL: same treatment — collapsed preview, full-width **Copy invitation** button on mobile, plus a QR-friendly compact layout so it can be scanned or shared rather than read.

### 3. Credential record cards
- Put the record id and protocol state on their own line as a muted meta row with a state pill, instead of a wrapping mono blob.
- Claims render as small label/value chips (`year 2026`, `degree BSc Computer Science`) rather than a joined mono string.
- Action buttons (Accept / Verify) become full-width on narrow screens and sit under the title, matching the rest of the console.

### 4. Forms on a phone
- Consistent 44px tall inputs, selects and buttons across the credentials, DIDs and wallet pages.
- Helper text under selects trimmed to one short line, with the longer explanation moved into a tap-to-expand hint so the form stays scannable.
- Claims JSON textarea gets horizontal scroll instead of pushing the card.

### 5. Toasts
Move toasts to the bottom on mobile so confirmations no longer sit on top of the header and the record they refer to.

## Technical notes

- `src/components/AppShell.tsx`: add width containment to the header row and `<main>` so no child can overflow the viewport.
- `src/routes/app.credentials.tsx`: extract a small `CredentialRecordRow` component plus a shared `TruncatedMono` (collapsed preview + copy) helper for JWT/invitation/DID display; drop the joined claims string in favour of chips.
- Reuse the same `TruncatedMono` helper in `src/routes/app.dids.tsx` and the wallet page so DID rendering is consistent.
- `src/components/ui/sonner` mount point in `src/routes/__root.tsx`: bottom position on small screens.
- Presentation only — no server functions, agent logic, or schema changes.
