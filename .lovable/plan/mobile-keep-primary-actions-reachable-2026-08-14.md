# Mobile: keep primary actions reachable

Long DIDs, JWTs and JSON claim editors push the important buttons off screen on a phone. This makes the primary action of each surface always reachable.

## What changes

**Sticky action bars on mobile forms**
- Create DID, New DIDComm invitation (DIDs page) and Offer credential (Credentials page): the primary button moves into a bar pinned to the bottom of the viewport while that card is in view, full-width, with a safe-area inset so it clears the phone's home bar. On tablet/desktop the button stays inline exactly as today.

**Actions before long values in list items**
- DID rows and credential records: Publish / Accept / Verify / Claim actions render above the long mono values (DID strings, credential JWT, invitation URL) so they are visible without scrolling past a wall of characters.

**Copy stays visible**
- The copy control on truncated mono values moves to the same row as its label (right-aligned) instead of below the collapsed text, so copying never requires expanding first.
- Copy and Reveal on the active-agent admin key follow the same pattern.

**Touch sizing**
- All these controls keep the 44px minimum touch height already used elsewhere, and rows use the grid + `min-w-0` pattern so nothing clips at 360px.

## Technical notes

- New `src/components/StickyActionBar.tsx`: renders children in a `sticky bottom-0 -mx-4 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[env(safe-area-inset-bottom)] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0` wrapper, so the same markup is sticky on mobile and inline from `sm:` up.
- `src/routes/app.dids.tsx`, `src/routes/app.credentials.tsx`: wrap the existing primary `<Button>` of each form card in `StickyActionBar`; move the existing action row above `TruncatedMono` blocks in list items. No handler or business-logic changes.
- `src/components/MonoValue.tsx`: label + copy on one `grid-cols-[minmax(0,1fr)_auto]` row; expand toggle stays below.
- `src/components/ActiveAgentCard.tsx`: admin-key row uses the same header-row pattern.
