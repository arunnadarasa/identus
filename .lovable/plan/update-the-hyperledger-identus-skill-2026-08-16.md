# Update the Hyperledger Identus skill

The skill draft at `.agents/skills/hyperledger-identus/` still describes the console as it was several rounds of work ago. Since then we fixed DIDComm invitation hosts, versioned the sandbox snippets, hardened the x402 Identus gate, reworked the ZK panel's loading behaviour, and moved the whole UI onto the premium design system with mobile-safe transcripts. This update folds those hard-won lessons into the skill so a future session doesn't rediscover them.

## What gets added

### New invariants (SKILL.md)
- DIDComm invitations must advertise a reachable host: the Fly agent exposes port 8090 and `DIDCOMM_SERVICE_URL` must point at the real app hostname, not a placeholder. Older apps are fixed with the repair endpoints action rather than a redeploy.
- Sandbox snippets are versioned: bumping the starter-snippet version is how breaking SDK changes reach users who already have saved snippets; a silent edit does not.
- REST snippets fail fast with a plain-English message when no real agent is configured, instead of throwing "Invalid URL" from an empty base URL.
- In the x402 / delegation gate, the human principal (credential subject) and the AI agent (mandate subject) are different identifiers; comparing them to each other is the classic false rejection.
- The ZK prover needs explicit per-phase progress, timeouts, and retry — a hanging WASM download otherwise looks like a frozen page.

### Updated sections
- **Key file map**: add the marketing header, mode badge, sticky action bar, transcript/JSON blocks, and delegation demo components; note the design tokens in `src/styles.css`.
- **Workflows**: add two short workflows — "Repair a Fly agent's DIDComm endpoint" and "Ship a breaking change to sandbox snippets".
- **UI conventions** (new short section): semantic tokens only, long identifiers rendered as shortened mono chips with the full value kept in the raw envelope, mobile burger nav on marketing pages, mode badge in the console header.

### Reference cards
- `references/failure-modes.md`: add the DIDComm placeholder-host symptom, the empty-agent "Invalid URL" symptom, and the subject/principal mismatch symptom, each with its fix.
- `references/sprites-quirks.md`: add snippet versioning plus the pinned SDK version and peer-dependency install note.
- `references/zk-integration.md`: add the progress/timeout/retry contract and the credential grouping by age-provability.
- New `references/mobile-and-design.md`: the premium token set, the grid+`min-w-0`+`shrink-0` header rule, and the transcript `values` pattern for long identifiers.

## Technical notes
- Edits stay inside `.agents/skills/hyperledger-identus/`; no application code changes.
- After the edits, the draft is activated with the apply-draft tool so the updated skill replaces the currently active copy.
- Keep SKILL.md scannable: invariants stay one line each, detail moves to reference cards.
