# SDK-ts quickstart: delegation credentials

A copy-paste panel that shows the minimum TypeScript needed to **issue** a delegation credential for an AI agent and then **verify** it before honouring a delegated action — the same shape the x402 gate and the /learn delegation demo already check.

## Where it goes

A new **Quickstart** card at the top of the **SDK snippets** tab on the Sandbox page (`/app/sandbox`), above the box status cards. It works whether or not a sandbox box exists — the snippets are reference code first, runnable second.

Two cross-links so people find it: a line in the docs SDK section and a pointer from the delegation walkthrough on `/learn`.

## What the panel shows

Four short snippets, each in its own tab with a copy-to-clipboard button:

1. **Install** — the two npm packages plus the pinned SDK version the sandbox uses.
2. **Issue a mandate** — create the issuer key, build the `AgentDelegationCredential` subject (`actsFor`, `agentDid`, `scope`, `spendLimit`, `allowedMerchants`, `validUntil`), sign it as an ES256 JWT.
3. **Verify a mandate** — decode, check the signature against the issuer key, then check the four things that actually matter: subject is the agent presenting it, scope covers the requested action, amount is within the cap, and it has not expired.
4. **Gate a request with it** — the ten-line version of what our own x402 proxy does: reject before doing the work, with the specific reason.

Each snippet ends with a `console.log` so a copy-paste into the sandbox editor produces visible output.

Extra affordances:
- **Copy** on every snippet, plus **Load into editor** when a sandbox box exists — drops the snippet into the runner below as a new unsaved snippet so it can be run immediately.
- A short "what this does not do" note: the demo signs with a locally generated key, so a production issuer would sign with a published `did:prism` assertion key from the Credentials page.

## Technical notes

- New component `src/components/SdkQuickstartPanel.tsx`: presentational, `Tabs` + `Button` + `Badge` from the existing UI set, clipboard via `navigator.clipboard.writeText` with a `sonner` toast, matching the copy pattern already in `MonoValue.tsx`.
- Snippet strings live in `src/lib/sprites/delegation-snippets.ts` (client-safe, same shape as `STARTER_SNIPPETS` in `snippets.ts`) so the sandbox seeding can reuse them later.
- Snippets use WebCrypto ES256 exactly like `src/components/learn/DelegationDemo.tsx`, and the claim names come from `DELEGATION_CREDENTIAL_TYPE` / `PAYMENT_SCOPE` in `src/lib/agentic/x402-mandate.ts` so the quickstart and the live gate cannot drift apart.
- "Load into editor" needs `SnippetRunner` to accept an optional incoming draft; add a `draft` prop plus a callback the panel calls, keeping the existing behaviour when nothing is passed.
- Mobile: snippets render in a horizontally scrollable `pre` with the copy button pinned outside the scroll area, so long lines never widen the page.
