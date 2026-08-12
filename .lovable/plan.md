# In-app docs: Sprites vs Fly Machines for Identus Cloud Agent

## Goal
Publish a concise, in-app comparison in the docs page that explains why hosted Identus Cloud Agents run on Fly Machines and what Sprites.dev cannot support.

## What to build
1. Add a new dedicated section on `/docs` titled "Where to run an Identus Cloud Agent".
2. Render a side-by-side comparison (table or two-column cards) covering:
   - Container image support
   - Multi-service composition (agent + PRISM node + Postgres)
   - Managed Postgres / private networking
   - Long-running services
   - SDK snippet sandbox suitability
3. State explicitly that Sprites.dev is used only for the per-user SDK snippet sandbox, not for hosting the agent stack.
4. Keep the existing "Running an agent" section intact; this new section should sit alongside it.

## Files to edit
- `src/routes/docs.tsx`: add the comparison section and any helper data arrays.

## Out of scope
- No backend or API changes.
- No navigation or route changes.
