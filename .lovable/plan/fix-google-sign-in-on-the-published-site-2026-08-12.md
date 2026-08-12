# Fix Google sign-in on the published site

## What we know

- The database error from before is gone: your Google account was created successfully and its profile, simulated agent and demo data are all seeded.
- On the published site the Google popup closes and the app stays on the sign-in page.
- The sign-in button currently has no error handling, no loading state and no listener for the session arriving — so if the popup returns nothing usable, or the helper throws, the click silently does nothing and you get no message at all.

The exact failure reason is not yet visible (no error is surfaced anywhere). Step 1 of this plan is to make the failure visible; steps 2-4 fix the known gaps that can cause a silent no-op.

## Plan

1. Surface the real error
   - Wrap the Google call in try/catch, show the actual message in the toast instead of a generic "try email instead", and log details to the browser console so we can read them if it still fails.
   - Add a "Signing in…" state on the button so it's obvious the flow is running and when it ends.

2. React to the session however it arrives
   - Subscribe to auth state changes on the sign-in page (not just a one-time session read on mount), so the moment the session is set the page navigates to the console.
   - After the popup flow returns, re-check the session and navigate if one exists, even if the helper's return value looked inconclusive.

3. Handle the "popup closed with no result" case explicitly
   - If the flow ends with no session and no error, show a clear message explaining the popup was closed or blocked before completing, with a retry action, plus the email/password path as a fallback.

4. Verify provider configuration
   - Re-run the managed Google provider configuration for this project so the published domain is registered for OAuth, and confirm email sign-in stays enabled as a fallback.

## Technical notes

- Files touched: `src/routes/auth.tsx` (error handling, busy state, `onAuthStateChange` subscription, post-popup session re-check). No backend/schema change is needed.
- Keep using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` — no custom `window.open`, no iframe detection, no alternate login route; the helper already handles popup and redirect modes.
- Google provider will be re-applied through the managed social-login configuration; no client ID/secret from you is required.

## After this change

If the popup still closes without signing you in, you'll now get a specific error message on screen — send that text (or a screenshot) and it points straight at the remaining cause.
