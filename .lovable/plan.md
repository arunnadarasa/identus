# AI agents FAQ section

## Goal
Add a dedicated FAQ block answering common questions about **delegation**, **selective disclosure**, and **verification** when AI agents use SSI credentials. Targeted at a non-technical audience, matching the plain-English tone of the existing FAQ.

## Approach
Add a new full-width FAQ block inside the existing `#agents` section of `src/routes/learn.tsx`, placed right after the `AgenticUseCases` cards and before the general `#faq` section. This keeps agent-specific questions with the agent content rather than mixing them into the general FAQ grid.

### Content
A new `agentFaqGroups` array with three sub-groups, each 4–5 Q&A pairs:

- **Delegation** — What does it mean for an agent to act on my behalf? How does it prove it's allowed? Can I limit what an agent can do? Can I revoke delegation? What stops an agent overstepping?
- **Selective disclosure** — How does an agent share only what's needed? Can an agent reveal more than I allowed? What about zero-knowledge proofs? Does selective disclosure work across services?
- **Verification** — How does a verifier know an agent is legitimate? Does the verifier need to trust me or the agent? What if the agent is offline? Can verification be automated by another agent?

Answers stay plain-English, short, and concrete (no jargon without a one-line gloss), consistent with the existing FAQ entries.

### Rendering
Reuse the existing `Accordion` / `AccordionItem` pattern already imported in the file. Render `agentFaqGroups` as a single-column stack (full width, no 3-col grid) under a "Questions about agents" heading, with the three sub-group headings in the same `font-mono uppercase text-primary` style as the general FAQ group headings.

No new components, no new imports, no layout changes to the general FAQ. One new `agentFaqGroups` const + one new `<section>` block inside `#agents`.

## Out of scope
- No changes to the general FAQ groups.
- No new routes or components.
- No backend or agent-logic changes.
