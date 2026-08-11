# Fix Google sign-in failure

## What's happening

Signing in with Google returns a server error. The auth logs show every
`grant_type=id_token` request failing with HTTP 500 and this database error:

```text
function digest(text, unknown) does not exist
```

Google sign-in is configured correctly. The failure happens one step later, when
the backend tries to create the new account row: the routine that bootstraps a
new user's workspace (default simulated agent, sample issuer/holder DIDs, demo
credential, activity entry) generates the demo DID strings with a hashing
function that isn't reachable from that routine, so the whole signup transaction
aborts and the sign-in returns an error.

Email/password signup goes through the same routine, so it is affected too.

## The fix

Rewrite the new-user bootstrap so DID generation no longer depends on an
unreachable hashing function, keeping the seeded demo data identical in shape:

- Replace the `digest(...)` based DID strings with a hash the routine can always
  resolve (schema-qualified pgcrypto call, or a stable hex derived from the
  user id), so `did:prism:<hex>` values still look and behave the same.
- Keep everything else in the bootstrap unchanged: profile row, default `user`
  role, active Simulated Agent connection, two DIDs, one schema, one verified
  demo credential, one peer connection, one activity entry.

## Verification

- Confirm the bootstrap routine runs cleanly against a test insert.
- Sign in with Google from the published app and confirm it lands in the console
  with the seeded simulated agent, DIDs and demo credential.
- Re-check the auth logs for absence of the 500 on `/token`.

## Technical notes

- Single database migration replacing `public.handle_new_user()`; the
  `on_auth_user_created` trigger stays as-is.
- Root cause is the function's `SET search_path = public`, which hides the
  pgcrypto `digest()` function installed in the `extensions` schema.
- No frontend or auth-provider changes needed.
