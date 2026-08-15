# Credential issuance rules

## Issuer DID capability

A credential offer is signed with the issuer's `assertionMethod` key. The Cloud Agent returns
`400` if the chosen DID cannot sign, and the message is unhelpful, so check first.

- `createDid` in `src/lib/identus.functions.ts` requests an `assertionMethod` key for issuer-role
  DIDs and triggers publication automatically. `long_form_did` and `publish_error` on
  `saved_dids` carry the interim state.
- A DID is only usable once **published** (`did:prism:<hash>` resolves on the PRISM node). Long-form
  DIDs are fine for holders, never for issuers.
- `resolveDidCapabilities` (`src/lib/identus/agent.server.ts`) resolves the DID document and reports
  its verification-relationship key purposes.
- `listIssuerDids` returns `{ dids, excluded }` — excluded entries carry a reason
  ("authentication key only", "not published yet", "resolution failed"). Render both: the
  dropdown lists usable DIDs, and the excluded list explains the gaps.
- `issueCredential` pre-flights the same check so a stale UI selection fails with a readable error.

Do **not** let the holder DID leak into the issuer slot. A holder DID (Alice) has no assertion key,
which is the classic "no published issuer DID with an assertion key" dead end.

## Connectionless offers

When the wallet has no established DIDComm connection:

- Omit `connectionId` from the offer body — sending it empty produces
  `Missing connectionId for credential offer`.
- Send `goalCode`, `goal`, and `credentialFormat: "JWT"`; the agent responds with an
  out-of-band `invitationUrl`.
- Persist that URL on `credential_records.invitation_url` and surface it as a copyable link /
  QR target — it is the only way the holder can accept.
- With a connection present, prefer `connectionId`; `listAgentConnections` returns established ones.

## Claim conventions

Claims are stored as a flat string map on `credential_records.claims`.

| Purpose | Keys |
| --- | --- |
| Age / ZK proofs | `dob`, `dateOfBirth`, `date_of_birth`, `birthDate`, `birth_date`, `birthYear`, `birth_year`, `yearOfBirth` |
| Identity display | `name`, `subject` |
| Agentic gates | schema name (e.g. `StudentID`) plus whatever the gate asserts |

`extractBirthYear` in `src/lib/zk-claims.ts` is the single source of truth for the accepted spellings;
extend that array rather than hardcoding a key anywhere else. Issuance templates on
`src/routes/app.credentials.tsx` include a `dob` claim so a demo credential works with `/app/zk`
immediately.
