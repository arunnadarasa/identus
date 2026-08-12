# Automatic mode recommendation UI

Add context-aware recommendation cards that guide users toward the right infrastructure choice for each task: Fly Machines for hosting real Identus Cloud Agents, and Sprites.dev only for local SDK snippet sandboxes.

## What to build

1. Reusable recommendation component
   - Create `src/components/ModeRecommendation.tsx`.
   - Two variants:
     - **Agent hosting recommendation** — explains why Fly Machines is the right choice for a Cloud Agent (multi-service composition: Agent + PRISM node + Postgres, managed networking, public URL, health checks).
     - **Sandbox recommendation** — explains that Sprites.dev is only for running SDK snippets and cannot host the Cloud Agent because it lacks container-image execution and multi-service orchestration.
   - Use existing Card/Badge/Icon components. Keep styling consistent with the dark OKLCH theme.
   - Make each card dismissible with `localStorage` so returning users do not see the same hint repeatedly.

2. Agents page (`src/routes/app.agents.tsx`)
   - Render the agent-hosting recommendation near the "Add an agent" card, above the Simulated / Docker local / Fly.io tabs.
   - Highlight the Fly.io tab as the recommended path for a persistent, reachable Cloud Agent.
   - Keep the existing Simulated and Docker local options available; the card is guidance, not a gate.

3. Sandbox page (`src/routes/app.sandbox.tsx`)
   - Render the sandbox recommendation near the top, below the page header.
   - Clarify that Sprites runs only the SDK snippet box, while the active agent (Simulated / Docker / Fly) supplies `AGENT_BASE_URL` and `AGENT_API_KEY`.

4. Optional docs enhancement (`src/routes/docs.tsx`)
   - If the existing comparison section is present, add a short callout that mirrors the recommendation wording so the guidance is consistent across the app.

## Out of scope

- No backend changes.
- No changes to Fly provisioning, Sprites API, or agent logic.
- No removal or restriction of existing modes.
