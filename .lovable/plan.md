# Fix the two failing sandbox snippets

The sandbox itself is healthy — the box boots, the SDK imports, and the agent calls work
(`exit 0` on connection invitation, DID publication, and presentation list). Two of the seeded
starter snippets are wrong, and one placeholder is unhelpful.

## What's broken

1. **Create a Peer DID → `exit 1`**
   The snippet prints `resolved.verificationMethod.length`. The DID it mints resolves fine
   (the peer DID prints correctly on the line above), but the resolved document in SDK 6.x does
   not expose a top-level `verificationMethod` array, so the read throws
   `Cannot read properties of undefined (reading 'length')`.
   Fix: read the document's core properties and count the verification methods found there,
   falling back to printing the document as JSON so the shape is visible in the output.

2. **Issue a credential offer → 400 Invalid UUID**
   The snippet ships literal `<connection-id>` and `<did:prism:...>` placeholders, so running it
   as-is always fails with a request-body decoding error.
   Fix: make it self-discovering — list the agent's connections, pick an established one, list the
   agent's published issuer DIDs, pick one with an assertion key, and only then send the offer.
   If either is missing, print a plain-English message telling the user what to create first
   in the console instead of firing a doomed request.

## Making the fix reach existing sandboxes

Starter snippets are inserted into your account once, the first time a box is created, so editing
the templates alone would not change the snippets already saved under your account.

- Add a "Reset starter snippets" action to the Sandbox SDK tab that re-writes the starter set by
  name (updating a saved snippet if the name matches, inserting it if not), leaving any snippet
  you wrote yourself untouched.
- Keep the existing first-run seeding as-is.

## Also cleaned up

The `using deprecated parameters for initSync()` line in the output is a harmless warning from the
SDK's WASM init and is not an error — a short note in the snippet comment says so, so it does not
look like a failure.

## Technical notes

- `src/lib/sprites/snippets.ts` — rewrite the "Create a Peer DID" and "Issue a credential offer"
  snippet bodies.
- `src/lib/sprites/sandbox.functions.ts` — add a `resetStarterSnippets` server function that
  upserts `STARTER_SNIPPETS` by `(user_id, name)`.
- Sandbox SDK tab UI — add the reset button, invalidate the snippet query afterwards.
- Verification: run both snippets in the live box after the change and confirm `exit 0`, with the
  credential-offer snippet either producing a real record id or printing the "create a connection
  first" guidance.
