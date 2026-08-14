# Fix credential offers against a real agent

The agent rejects the offer with `[400] Missing connectionId for credential offer`. The offer request currently sends only `issuingDID`, `claims`, `credentialFormat` and `automaticIssuance`. A real Cloud Agent needs either an established DIDComm connection to send the offer over, or an explicit connectionless offer (which returns an out-of-band invitation instead).

## What changes

1. **Pick a DIDComm connection on the Credentials page**
   - Add a "Send over connection" selector above the offer form, listing the established DIDComm connections from the workspace (the ones created on the Wallet/Demo flow), plus a "Connectionless (invitation)" option.
   - Disable the "Offer credential" button when the active agent is a real agent (docker/fly) and neither a connection nor connectionless is chosen, with an inline hint linking to where connections are created.
   - Simulated mode keeps working exactly as today with no selection required.

2. **Send the right request shape**
   - When a connection is selected: include its agent-side `connectionId` in the offer body.
   - When connectionless is selected: call the agent's connectionless offer endpoint (`/issue-credentials/credential-offers/invitation`) and store the returned invitation URL/OOB id on the credential record so it can be shown and copied.
   - Surface the agent's `detail` message verbatim on failure (as it already does) instead of a generic error.

3. **Show established connections that exist only on the agent**
   - The selector reads the connections the agent itself reports (`GET /connections`, filtered to `ConnectionResponseReceived`/`ConnectionResponseSent`) merged with the locally stored ones, so an agent-side connection made outside this console is still selectable.

4. **Empty state**
   - If a real agent is active but has zero usable connections, the card shows a short "create a DIDComm connection first" state with a button to the connection flow, rather than letting the user hit a 400.

## Technical notes

- `issueCredential` in `src/lib/identus.functions.ts` gains optional `connectionId` and `connectionless` inputs; the non-simulated branch chooses the endpoint and body accordingly.
- A new `listAgentConnections` server fn wraps `agentFetch(conn, "/connections")` for the selector; simulated mode returns the rows from `sim_connections`.
- Store the invitation URL for connectionless offers in the existing `credential_records` row (new nullable `invitation_url` column via migration, with grants unchanged for the table).
- UI work is contained in `src/routes/app.credentials.tsx`.
