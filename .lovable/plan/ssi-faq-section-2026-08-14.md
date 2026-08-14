# SSI FAQ section

## Goal
Add a simple, non-technical Q&A FAQ about DIDs, verifiable credentials, and verification to the existing `/learn` explainer page so readers can get quick answers without re-reading the long-form sections.

## Approach
Add the FAQ as a new section on `/learn` (not a separate route), reusing the existing `Accordion` component (`@/components/ui/accordion`). It lives between the "Where Identus fits" section and the footer, and gets an entry in the page's sticky `sectionNav` strip so it is reachable from the top.

## Changes

### 1. `src/routes/learn.tsx`
- Import `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion` and a `HelpCircle` icon from `lucide-react`.
- Add `{ id: "faq", label: "FAQ" }` to the `sectionNav` array so the sticky nav links to it.
- Add an `faq` data array of ~10 plain-English Q&A pairs grouped under three headings: **DIDs**, **Credentials**, **Verification**. Each entry is `{ q, a }`.
- Insert a new `<section id="faq">` before the footer with:
  - A `Badge` ("Quick answers") + `h2` heading.
  - Three sub-headed groups (DIDs / Credentials / Verification), each rendered as an `Accordion type="multiple"` with `AccordionItem`s for its Q&As.
  - Plain-English answers (1–3 sentences), no jargon, consistent with the tone of the rest of `/learn`.
- A closing line linking to `/docs` ("Want the technical version? Read the primer.").

### 2. Content (the Q&As)
- **DIDs**: What is a DID? / Is a DID like a username? / Where does a DID live? / What does "published" mean? / Can I have more than one?
- **Credentials**: What is a verifiable credential? / Who issues them? / Where are they stored? / Can they expire or be revoked? / Are they stored on a blockchain?
- **Verification**: How does someone check a credential? / Do they call the issuer? / What can a verifier see? / Can a credential be faked? / Does verification need the internet?

## Non-goals
- No new route, no backend, no server functions.
- No changes to the console, docs route, or other pages beyond the nav link already on `/learn`.
- Mobile overflow already handled by the page wrapper; FAQ uses the same responsive container.
