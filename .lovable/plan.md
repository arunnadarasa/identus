# Fix: Google sign-in lands on the landing page

## What's happening

Google sign-in sends you back to the site root (`/`) after authentication. The landing page has no idea you're signed in, so it just renders the marketing page with an "Open console" button that still points at the sign-in screen. The session is actually valid — nothing takes you to the console.

## The fix

1. **Dedicated callback route** — add `/auth/callback`, and use it as the Google return URL instead of the bare site root. It waits for the session to be confirmed, then sends you straight to the console. It also honours a saved "intended destination" so a deep link you clicked before signing in is respected.

2. **Session-aware landing page** — if you're already signed in and land on `/`, the header CTA becomes "Open console" pointing at `/app` (plus an account/sign-out affordance), and the hero's primary button goes to the console rather than the sign-in page. No forced redirect, so the landing page stays shareable and crawlable.

3. **Sign-in page hardening** — keep the existing auth-state listener, and clear the stale "Signing in…" state if the popup returns without a session.

## Technical notes

- New `src/routes/auth.callback.tsx` (`/auth/callback`, public, no auth gate): shows a brief "Completing sign-in…" state, waits on `supabase.auth.getSession()` / `onAuthStateChange`, then `navigate({ to: <saved path or "/app">, replace: true })`; on failure it redirects to `/auth` with an explanatory toast.
- `src/routes/auth.tsx`: `redirect_uri: ${window.location.origin}/auth/callback`; store only a sanitised same-origin path in `sessionStorage` before starting OAuth.
- `src/routes/index.tsx`: read session via the existing `useAuth` hook and swap the CTA targets/labels accordingly.
- No database or server-function changes.
