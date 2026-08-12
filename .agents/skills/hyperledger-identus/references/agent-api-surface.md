# Identus Cloud Agent REST API surface

## Base URL and auth

`agentBaseUrl(conn)` resolves the base:
- `simulated` → empty (no real calls).
- `docker` → `conn.base_url` as-is (e.g. `http://localhost:8085/cloud-agent`).
- `fly` → `https://<app>.fly.dev`, with any `/cloud-agent` suffix stripped.

All real calls send `apikey: <conn.api_key>` as a header (not `Authorization: Bearer`). `agentFetch` adds `Content-Type: application/json` and a 15s timeout.

## Probe endpoints (`probeAgent`)

| Check | Path |
| --- | --- |
| System health | `GET /_system/health` |
| DID registrar | `GET /did-registrar/dids?offset=0&limit=1` |
| Credential issuance | `GET /issue-credentials/records?offset=0&limit=1` |
| DIDComm connections | `GET /connections?offset=0&limit=1` |

The probe returns `ProbeResult` with per-check `ProbeCheck` (status, latency, detail). Healthy = system check OK and no failed checks. A 401/403 on a non-system check means the API key was rejected.

## Core endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/_system/health` | Agent health + version |
| `POST` | `/did-registrar/dids` | Create a managed DID (long-form) |
| `POST` | `/did-registrar/dids/{did}/publications` | Publish a DID to the ledger |
| `POST` | `/connections` | Create a DIDComm out-of-band invitation |
| `POST` | `/issue-credentials/credential-offers` | Offer a verifiable credential |
| `POST` | `/present-proof/presentations` | Request a presentation from a holder |

## Simulated mode helpers

When `mode === "simulated`, no real HTTP is made. `makePrismDid(seed)` returns a `did:prism:<sha256>` string. `makeCredentialJwt({issuer, subject, claims, schema})` builds a structurally-valid W3C JWT VC with a fake signature. These back the in-app mock for DIDs and credentials.

## SDK snippet env injection

Sprites sandbox snippets read `process.env.AGENT_BASE_URL` and `process.env.AGENT_API_KEY`. The sandbox provisions these from the user's active agent connection so snippets can call the live Cloud Agent. Starter snippets live in `src/lib/sprites/snippets.ts` and use `@hyperledger/identus-edge-agent-sdk` for peer-DID creation or raw `fetch` for REST calls.

## Activity logging

`logActivity(db, userId, connectionId, kind, summary, status)` writes to `activity_log`. Call after every meaningful operation (deploy, key rotation, DID creation, credential issuance) so the Activity page reflects reality.
