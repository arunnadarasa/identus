# Fix connectionless credential offer (500 from agent)

## What's happening

The credential form is offering with **Issuer DID = "Alice (Holder)"**, one of the demo DIDs seeded into your workspace when your account was created (`did:prism:<md5...>`). Those DIDs exist only in this app's database — the Fly-hosted agent has never heard of them, and it has no signing key for them. When it tries to build a JWT credential offer with an unknown issuing DID it fails with a generic `500 Internal Server Error` instead of a helpful message.

Two secondary issues make this worse:
- The Issuer DID dropdown lists every saved DID regardless of role or publication status, so a holder/verifier DID can be picked as issuer.
- The connectionless invitation request omits fields the agent expects, and the 500 body is shown raw with no guidance.

## The fix

1. **Only offer real, usable issuer DIDs.** On docker/fly mode, load the DIDs from the agent itself (`/did-registrar/dids`) and restrict the Issuer DID dropdown to DIDs that are `PUBLISHED` and have an `assertionMethod` key. Demo/simulated DIDs stay available only in simulated mode.
2. **Guard the empty case.** If the connected agent has no publishable issuer DID, disable the Issue button and show an inline prompt linking to the DIDs page to create and publish one first.
3. **Complete the invitation payload.** Send `goalCode`, `goal`, and `credentialFormat: "JWT"` with the issuing DID for `/credential-offers/invitation`, and drop the unused holder DID from the JWT connectionless request.
4. **Readable agent errors.** Map agent 4xx/5xx responses on credential offers to a short explanation (unknown/unpublished issuing DID, schema mismatch, no connection) while keeping the raw detail in an expandable section and in the activity log.

## Technical notes

- `src/lib/identus.functions.ts`: add an agent-backed `listIssuerDids` server function; extend `issueCredential` to validate the issuing DID against the agent's DID list before posting, and to enrich thrown errors.
- `src/routes/app.credentials.tsx`: source the Issuer DID select from the new function when mode is not simulated, add the empty-state guard, and render the friendlier error.
- No database or schema changes needed.
