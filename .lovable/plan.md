# Refresh the homepage with everything the app now does

The landing page still only advertises the original scope: three agent modes and the core credential console. Everything added since — the ZK proof panel, the agentic commerce demos, the SDK sandbox, the Learn and NHS pages — is invisible to a first-time visitor. This updates the homepage to reflect the current product.

## What changes

1. **Hero**
   - Sharper subheadline that names the three pillars: run a real Cloud Agent, prove claims with zero-knowledge, and let AI agents transact under delegated authority.
   - Keep the existing session-aware primary button (console vs. sign-in) and "Read the primer".
   - Add a third, low-emphasis link to the Learn page for non-technical visitors.

2. **New section: "Beyond the basics"** (3 cards, placed after the hero, before the agent modes)
   - **Zero-knowledge proofs** — prove "over 18" from a real Identus credential in the browser with Noir, without revealing the date of birth. Links to `/app/zk`.
   - **Agentic commerce** — A2A, AP2, UCP and x402 (Base Sepolia) demos where an AI agent pays only when its delegation credential checks out. Links to `/app/demos`.
   - **SDK sandbox** — a per-user scratch box with runnable Identus TypeScript snippets and a Docker Compose lab. Links to `/app/sandbox`.

3. **Capabilities list** — extend the existing six entries with: delegation credentials for AI agents, ZK-bound presentations, and the sandbox snippet library.

4. **New section: "Learn the concepts"** — two compact link cards pointing at `/learn` (SSI explained for non-technical readers, interactive credential and delegation demos) and `/nhs` (what a single patient record could look like with verifiable credentials).

5. **Footer** — unchanged apart from adding a Learn link alongside the docs and GitHub links.

6. **Metadata** — update the title/description and og tags so the search and share preview mention zero-knowledge proofs and agentic demos.

## Notes

- Cards that link into `/app/...` respect sign-in state: signed-out visitors are sent to `/auth`, matching the current hero behaviour.
- Presentation-only change, all inside `src/routes/index.tsx` using existing shadcn primitives and semantic tokens; no new dependencies, no backend or business-logic edits.
- Mobile behaviour keeps the existing `MarketingHeader` burger menu and stacks all new grids to a single column.
