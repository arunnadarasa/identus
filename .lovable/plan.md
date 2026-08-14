# NHS Single Patient Record page

A new public page at `/nhs` that explains the NHS England Single Patient Record (SPR) programme and shows, concretely, where verifiable credentials and Identus fit — for NHS digital, policy, and supplier audiences rather than crypto developers.

## Why this page

The SPR is NHS England's plan to bring a person's health information together into one record they and their care team can see, accessible through the NHS App, with staff-facing access across settings. It raises exactly the questions this app already demonstrates: who is asking, what are they allowed to see, and how does the patient know and control it. This page connects that public programme to the working demos already in the console.

## Page outline (`/nhs`)

1. **Hero** — "The Single Patient Record, with consent you can prove." One-paragraph plain-English framing plus a link to the NHS England SPR page as the source of record, and a clear note that this is an independent explainer, not an NHS service.
2. **What the SPR is** — three cards: one record per person, visible in the NHS App, shared across care settings. Written for a non-technical reader.
3. **The four hard problems** — identity assurance (is this really the patient / clinician?), authorisation (which slice of the record, for how long?), consent and audit (patient-visible, revocable), and cross-organisation trust (no single database of every credential).
4. **Where credentials fit** — a diagram-style section mapping each problem to a credential pattern: patient identity credential, clinician/role credential (e.g. registered nurse at a named trust), care-relationship credential granting scoped access, and revocation when a role or consent ends.
5. **Interactive walkthrough** — a stepped, click-through scenario: an out-of-hours pharmacist requests medication history → patient's wallet shows exactly which fields are asked for → patient consents → pharmacist's role credential is verified → access is granted for a bounded window → patient revokes later, with an audit entry at every step. Same interaction style as the existing `/learn` credential demo, no backend calls.
6. **Selective disclosure in practice** — a small comparison: "share the whole record" vs "prove one fact" (over 18, currently pregnant, on this medication) reusing the existing disclosure-chips pattern.
7. **AI agents and the record** — short section: as care navigation and triage agents appear, a delegated agent needs a provable mandate and a scoped, auditable grant. Links to the agentic demos.
8. **What this is not** — honest limits: not clinical advice, not an NHS product, no real patient data, the demos issue demo credentials.
9. **Next steps** — buttons to `/learn`, `/app/demos`, and `/docs`.

## Technical notes

- New route `src/routes/nhs.tsx` using `createFileRoute("/nhs")`, with its own `head()` (title, description, `og:title`, `og:description`, `og:type`, `twitter:card`) and a single `<h1>`.
- Presentational components under `src/components/nhs/`: `SprPillars.tsx`, `SprProblemGrid.tsx`, `CredentialMap.tsx`, `PatientConsentDemo.tsx` (the stepped walkthrough, local `useState` only).
- Reuses existing primitives: `Card`, `Badge`, `Button`, `Accordion`, and the section-nav pattern from `learn.tsx`. All colours via existing semantic tokens — no hardcoded colour utilities, no NHS logos or NHS Blue brand assets.
- Sticky in-page section nav on desktop, horizontally scrollable on mobile, matching `/learn`.
- Nav links added to `src/routes/index.tsx`, `src/routes/learn.tsx`, and `src/routes/docs.tsx` header link rows.
- No database, server function, or backend change. Fully static and SSR-safe.

## Out of scope

- Any real NHS integration, NHS login, or NHS App connection.
- Storing or processing health data.
- Claiming NHS endorsement or reproducing NHS branding.
