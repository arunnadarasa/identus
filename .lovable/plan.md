# Fix the ZK panel dead end when a credential has no birth date

## What's happening

The Zero-knowledge page lets you pick any credential the console issued, but the age proof only works when that credential carries a date-of-birth claim. Your `UniversityDegree` credential has claims like `degree` and `year` — no birth date — so the panel shows the red warning and disables **Generate proof** with no way forward from that screen.

Two things caused this:

- The credential dropdown lists every credential, including ones the age circuit cannot use, and offers no hint before you pick.
- The Credentials page issues with a default claims template of `degree` / `year`, so a credential issued through the happy path never has a `dob` claim.

## The fix

1. **Mark usable credentials in the picker.** Split the dropdown into "Can prove age" and "No birth date" groups, show the detected birth year next to usable entries, and preselect the first usable credential instead of leaving a blocked one selected.

2. **Turn the dead end into a next step.** When the chosen credential has no birth date, replace the red-only message with a short explanation plus two actions: "Use manual entry instead" (switches to the existing unbound demo mode and keeps the page usable) and "Issue a credential with a birth date" linking to the Credentials page.

3. **Make the issuance path produce provable credentials.** Add a claims preset on the Credentials page — an "Age-provable ID" template whose claims include `dob` (plus name/schema defaults) — and a one-click "Add dob claim" helper that inserts a `dob` field into whatever JSON is already in the box. The existing default template also gains a `dob` entry so the standard demo credential works with the proof out of the box.

4. **Explain the requirement up front.** A one-line note under the picker states which claim names the circuit accepts (`dob`, `dateOfBirth`, `birthDate`, `birthYear`, and the snake_case variants), so it's clear what to issue.

## Technical notes

- `src/lib/zk-claims.ts` already resolves the accepted claim keys; the picker will call `extractBirthYear` per credential to build the two option groups. No change to the parser or the Noir circuit.
- `src/components/zk/zk-proof-client-entry.tsx`: group the `<select>` with `<optgroup>`, add a preselect effect for the first provable credential, and replace the `blocked` block with the explanation plus the two actions.
- `src/routes/app.credentials.tsx`: add the preset buttons that write into the existing `claimsText` state, and include `dob` in the initial template. Issuance logic itself is unchanged.
- No database or agent changes.
