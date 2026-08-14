# Interactive credential demo on /learn

Add a self-contained, click-through demo that walks a non-technical reader through issuing and verifying a credential — no agent, no login, no network calls.

## What the reader sees

A new "Try it" section on /learn, placed after the Three ideas section, with a stepper:

1. **Issuer offers** — pick a sample credential ("Student ID" or "Over 18"). Shows Acme University as issuer.
2. **Holder accepts** — the credential animates into a small wallet card with the claims listed.
3. **Verifier asks** — a request appears: "Prove you are over 18" — only the needed claim is highlighted.
4. **Holder proves** — reader taps Share; only the selected claim leaves the wallet.
5. **Verified** — green result panel showing what was checked (signature valid, issuer known, not expired, not revoked) and, crucially, what was *not* revealed.

Controls: Next / Back / Start over. Each step has one short plain-English caption plus an optional "what's happening technically" toggle line (DID, VC, proof presentation) for curious readers.

## Behaviour

- Pure client-side state; deterministic fake data (sample DIDs shortened, fake signature string).
- Mobile-first: vertical stack on small screens, side-by-side issuer/holder/verifier lanes on desktop; long DID strings use the existing MonoValue truncation.
- Respects reduced-motion; transitions are simple fades/slides.
- Ends with a CTA: "Do this for real in the console" linking to the credentials page.

```text
[Issuer]  --offer-->  [Holder wallet]  --proof-->  [Verifier]
   Acme University        Student ID            Bar entrance
                          over18: true            ✓ verified
```

## Technical notes

- New `src/components/learn/CredentialDemo.tsx` (plus small internal subcomponents in the same folder if it grows) holding step state via `useState`, no server functions, no Cloud calls.
- Reuses existing shadcn Card/Button/Badge and `MonoValue`; colours from existing semantic tokens only.
- `src/routes/learn.tsx`: add `{ id: "demo", label: "Try it" }` to `sectionNav` and render `<section id="demo" className="scroll-mt-16">` with the component.
- No schema or backend changes.
