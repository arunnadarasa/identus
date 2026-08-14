# Make real-agent DIDs usable as issuers

## What's wrong

You created a DID with role "Issuer" on the Fly-hosted agent and it succeeded, but the credentials page still says "This agent has no published issuer DID with an assertion key". Both halves of that message are literally true today, and it's our code's fault, not the agent's:

1. When talking to a real agent, DID creation always asks for a single key with purpose `authentication` — the selected role (issuer/holder/verifier) is only stored in our database, never sent to the agent. So no DID ever gets an assertion key.
2. We never publish the DID. The agent returns it in state `CREATED` (long-form only), and the issuer list requires `PUBLISHED`, so the dropdown is always empty in docker/fly mode.

## What to build

**Role-aware key template.** Creating an "Issuer" DID sends an `assertionMethod` key (plus `authentication`), a verifier sends `authentication`, holder unchanged. Issuer DIDs also get a `keyAgreement` key so they can be used for DIDComm later.

**Publish step.** After creation, issuer/verifier DIDs are submitted to the agent's publication endpoint. Publication is asynchronous (it anchors on-chain / in the PRISM node), so:
- The saved DID row records the real agent status (`CREATED` -> `PUBLICATION_PENDING` -> `PUBLISHED`) and both the long-form and short-form DID.
- The DIDs page polls pending DIDs and updates the badge as they progress, with a clear "publishing, this can take a few minutes" hint instead of a silent `CREATED` badge.
- A manual "Publish" action on any unpublished DID, for DIDs created before this fix.

**Issuer list honesty.** The issuer dropdown keeps requiring a published DID, but the empty-state message becomes actionable: it distinguishes "no DIDs on this agent yet", "your DID is still publishing" and "your DIDs have no assertion key — create a new issuer DID". If a DID is mid-publication, the credentials page shows that instead of the red error.

**Demo DID separation.** The seeded Alice/University DIDs are labelled as simulated-only in the DIDs list when a real agent is active, so they stop looking like valid issuer choices.

## Technical notes

- `createDid` in `src/lib/identus.functions.ts`: build `documentTemplate.publicKeys` from the role; after `POST /did-registrar/dids`, call `POST /did-registrar/dids/{didRef}/publications` for issuer/verifier, tolerating a non-2xx (record the DID, surface the publish error in the returned row rather than throwing).
- New `refreshDidStatus` server fn: `GET /did-registrar/dids/{did}` for rows whose status isn't `PUBLISHED`, writing back status and the short-form DID; called on an interval from `src/routes/app.dids.tsx` while any row is pending.
- `saved_dids` migration: add `long_form_did` and `publish_error` columns (nullable), keeping `did` as the canonical short form once published.
- `listIssuerDids` returns a reason code alongside `dids` so `src/routes/app.credentials.tsx` can pick the right message.
- Verify end-to-end against the live Fly agent: create issuer DID, watch it reach `PUBLISHED`, then send a connectionless offer.
