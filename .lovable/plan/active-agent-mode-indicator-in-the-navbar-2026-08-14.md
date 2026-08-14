# Active agent mode indicator in the navbar

Show at a glance which agent mode the console is using: Simulated, Docker local, or Fly.io.

## What you'll see

- A small pill in the header, next to the logo, e.g. `Simulated`, `Docker local`, or `Fly · identus-agent-dcdf`.
- Colour-coded per mode so the mode is recognisable without reading: Simulated = muted/grey, Docker = blue, Fly = primary teal.
- A tiny status dot on the pill reflecting the last health result (healthy / unhealthy / unknown).
- Clicking the pill navigates to the Agents page to switch or inspect the agent.
- On mobile the pill sits in the header row (compact: mode only, no app name) and a full-width version appears at the top of the slide-in menu.
- If no connection is active yet, the pill reads `No agent` and links to Agents.

## Technical notes

- New `src/components/ModeBadge.tsx`: presentational pill taking `mode`, `name`, `health`, plus a `compact` prop; uses semantic tokens only.
- New `src/hooks/useActiveConnection.ts`: `useQuery` over the existing `listConnections` server fn (via `useServerFn`), selecting `is_active`; short `staleTime` and shared query key `["connections"]` so it reuses/refreshes with the Agents page cache.
- `src/components/AppShell.tsx` renders `ModeBadge` in the desktop header and in the mobile header + sheet header.
- Labels come from the existing `MODE_LABELS` map in `src/lib/identus/types.ts`; no new server functions or schema changes.
