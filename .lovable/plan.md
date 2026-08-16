# Mobile UX fix: long identifiers overflow the demo transcripts

## What's wrong

On the AP2 demo (`/app/demos/ap2`), the "Mandate chain" step text drops a full 42-character
wallet address straight into a sentence:

```text
Recovered signer 0x584f6325538Dff80743C67Bb68daFe811E05… matches the connected address.
```

The paragraph has no break opportunity for a long unbroken token, so on a phone the address
runs past the card edge and gets clipped (visible in the screenshot). The same pattern is used
for hashes and transaction ids in the other demo transcripts.

## What to change

1. **Transcript step text wraps safely** — in `src/components/agentic/TranscriptView.tsx`, let the
   detail paragraph break inside long tokens and stop the list item from being pushed wider than
   its container. Header row also gets a min-width guard so the label truncates instead of
   stretching the card.

2. **Long identifiers become short mono chips, not inline prose** — the step model gets an
   optional list of `values` (label + full value). Long things (recovered signer, cart hash,
   transaction hash) move out of the sentence and render as compact `label: 0x584f…E053` rows
   using the existing `TruncatedMono` component, which already handles copy + truncation. The
   sentence keeps the meaning ("Recovered signer matches the connected address"), the exact bytes
   stay one tap away and remain in the raw envelope.

3. **Apply it across all four demos** — `app.demos.ap2.tsx`, `app.demos.a2a.tsx`,
   `app.demos.ucp.tsx`, `app.demos.x402.tsx`: replace the inline full-length addresses/hashes in
   `detail` strings with the new `values` rows.

4. **Raw envelope viewer on small screens** — `JsonBlock` keeps its horizontal scroll but gets a
   `min-w-0` wrapper so a wide JSON line can never widen the card itself.

5. **Verify on a phone viewport** — screenshot `/app/demos/ap2` at 390px wide and confirm the
   document has no horizontal overflow before and after running the flow.

## Technical notes

- New optional field on `TranscriptStep`: `values?: { label: string; value: string }[]`.
- Wrapping uses `break-words` plus `[overflow-wrap:anywhere]`; cards get `min-w-0`.
- No changes to protocol logic, signing, gates, or server functions — presentation only.
