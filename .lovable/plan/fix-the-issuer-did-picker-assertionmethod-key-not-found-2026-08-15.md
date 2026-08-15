# Fix the issuer DID picker (AssertionMethod key not found)

## What's actually wrong

The offer failed with:

```
400 BadRequest — AssertionMethod key not found for the
did:prism:5efc3def…b940bd3c
```

I resolved both DIDs your agent owns:

| DID | Keys in the DID document | Can issue? |
| --- | --- | --- |
| `did:prism:5efc3def…bd3c` | `auth-1` only (authentication) | No |
| `did:prism:299edfcd…6a00` ("Krump University") | `agree-1`, `assert-1`, `auth-1` | Yes |

So the agent is fine and Krump University is a valid issuer. The bug is in the
picker: the agent's DID list endpoint returns only `{ did, status }` — no key
information at all. Our filter treats "no key info" as "assume it can issue",
so the authentication-only DID is offered as an issuer and the form used it.

## The fix

1. **Filter on the real DID document.** After listing published DIDs, resolve
   each one and keep only those whose document has a non-empty
   `assertionMethod`. Cache the resolutions per request so the list stays fast.
   (Resolution needs a permissive `Accept` header — `application/json` returns
   406 on this agent build; `*/*` works.)
2. **Label the dropdown usefully.** Show the saved alias from your DIDs page
   when we have one ("Krump University") instead of a raw DID prefix, plus the
   key purposes we found.
3. **Explain excluded DIDs.** When a published DID is skipped because it has no
   assertion key, say so under the dropdown rather than silently hiding it, with
   a pointer to create an issuer DID on the DIDs page.
4. **Same check before sending.** In the issue path, verify the chosen DID has
   an assertion key and fail with a plain message instead of surfacing the raw
   agent 400.
5. **Mark it on the DIDs page.** Show a small "cannot issue — authentication
   only" note on published DIDs without an assertion key so the state is
   visible where DIDs are managed.

## Technical notes

- `src/lib/identus.functions.ts` → `listIssuerDids`: replace `hasAssertionKey`
  (which inspects fields the list response doesn't return) with a resolver-based
  check against `GET /dids/{did}`; keep the existing `reason` values
  (`publishing`, `no_assertion_key`, `no_dids`) so the UI copy still applies.
- New shared helper in `src/lib/identus/agent.server.ts` to resolve a DID
  document and return its verification-relationship summary; reused by
  `issueCredential`'s pre-flight check and the DIDs page.
- `src/routes/app.credentials.tsx`: richer option labels and an excluded-DID
  hint; no change to the submit payload shape.
- No database or migration changes.
