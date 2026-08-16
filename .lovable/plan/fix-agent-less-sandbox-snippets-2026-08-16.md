# Fix agent-less sandbox snippets

## What's wrong

The saved run of "List presentation records" failed with:

```text
TypeError: Failed to parse URL from /present-proof/presentations
[cause]: TypeError: Invalid URL
```

The snippet reads the agent URL from the environment, but your active agent is in
simulated mode, so that value is injected as an empty string. `"" + "/present-proof/presentations"`
is a relative path, and Node's `fetch` rejects it with a confusing URL parse error
instead of saying "no agent configured".

This affects every REST snippet, not just this one: all five agent-calling starters
(list DIDs, list connections, create offer, issue flow, list presentations) build their
URL the same way and will fail identically while in simulated mode.

## The fix

1. Add a small guard at the top of every agent-calling starter snippet: if the agent
   base URL is empty, print a plain-English message ("No REST agent configured — this
   snippet needs a Docker local or Fly.io agent; you're in simulated mode") and exit
   cleanly instead of throwing a URL error.
2. Also trim a trailing slash from the base URL so a pasted `https://host/` doesn't
   produce doubled slashes.
3. Bump each touched snippet's template version so the Sandbox flags your saved copies
   as stale and the existing "Refresh"/"Reset starter snippets" actions pull the fix in.
4. In the Sandbox UI, when the active agent is simulated, show the existing agent-mode
   notice as a clear inline warning above the editor so it's obvious before you hit Run.

No backend or database changes are needed.

## Technical detail

- `src/lib/sprites/snippets.ts` — shared guard prelude prepended to the five REST
  snippets; `version` bumped on each.
- `src/routes/app.sandbox.tsx` / `src/components/SnippetRunner.tsx` — surface the
  simulated-mode notice returned by `getSandbox` next to the Run button.
