# Agentic demos: A2A, AP2, UCP, x402

Four standalone demo routes showing AI agents transacting with verifiable identity, wired to the existing Identus console. Each demo works with zero secrets (simulated) and upgrades to real calls when the matching credential is present.

## The demos

**`/demo/a2a` — Agent-to-Agent negotiation**
Two agents (Buyer and Seller) exchange A2A 0.3 JSON-RPC messages over a real task lifecycle (`submitted → working → input-required → completed`). Each agent publishes an agent card containing its DID. Before accepting, the Seller asks the Buyer for a credential proof; the Buyer presents it and the Seller verifies it. AIsa drives the negotiation reasoning (the Buyer argues for a lower price, the Seller counters), so the transcript is genuinely different each run. UI: side-by-side agent lanes, live message transcript with typed DataParts, and an expandable raw JSON-RPC envelope per step.

**`/demo/ap2` — Agent Payment Mandates**
The delegation story: you sign an Intent Mandate ("book travel, max EUR 500, 30 days"), the agent turns it into a Cart Mandate, then a Payment Mandate. Each mandate is EIP-712 signed by the Privy embedded wallet, and the same delegation is mirrored as a real Identus verifiable credential so you can see the SSI equivalent side by side. Revoking the credential in the console visibly invalidates the mandate chain. UI: three-stage mandate builder, signature inspector, and a revoke button that flips the chain to invalid.

**`/demo/ucp` — Universal Commerce Protocol**
A merchant endpoint implementing UCP discovery → checkout → order, with RFC 9421 HTTP Message Signatures on the responses and a client-side signature verifier. Includes a conformance self-test panel that runs every op and shows pass/fail per check. The buyer agent presents merchant-required credentials (age, entitlement) from the Identus agent during checkout instead of creating an account. UI: op-by-op request/response viewer with signature verification badges plus a "Run conformance self-test" button.

**`/demo/x402` — Pay-per-call on Base Sepolia**
Real testnet payment. Four logged steps: challenge (`402` + `accepts[]`), sign (EIP-3009 authorisation via Privy embedded wallet), retry with `PAYMENT-SIGNATURE`, settle (decode `PAYMENT-RESPONSE`, link the tx on Basescan). Shows the wallet address, USDC balance, a Circle faucet link, and a refresh-balance button. The unlocked payload is gated on both payment proof and a credential proof, so the demo shows price + authorise in one round trip.

## Identity behaviour

Each demo probes the active Identus agent on load. When healthy, agent DIDs and credentials are real (created and verified through the agent); when not, it falls back to the simulated agent and shows a clear "simulated" badge. A shared banner at the top of every demo says which mode is live and links to the Agents page.

## Shared shell

A `/demo` index page introduces the four rails, how they compose (negotiate → mandate → checkout → settle), and where SSI fits. Cross-links added from `/learn`'s AI agents section and from `/docs`. Each route gets its own SEO metadata.

## Credentials needed

- **AISA_API_KEY** — powers the A2A negotiation reasoning. Without it the negotiation replays a scripted transcript.
- **PRIVY_APP_ID** and **VITE_PRIVY_APP_ID** — embedded wallet for EIP-712 mandate signing and the x402 payment. Without them, AP2 and x402 render in simulated mode.
- No new blockchain deploy is needed; x402 uses the public PayAI facilitator on Base Sepolia and Circle's USDC. You fund your Privy address from the Circle faucet.

## Technical notes

- Follows the `ucp-a2a-ap2-negotiation`, `aisa`, `lovable-base-x402`, and `evvm-privy-integration` skills, and the existing `hyperledger-identus` server/client split.
- Skill assets are Supabase edge functions; they get ported to TanStack server routes under `src/routes/api/public/` (`a2a-buyer`, `a2a-seller`, `ucp-merchant`, `x402-proxy`) since external agent-to-agent callers need raw HTTP. Signature verification happens inside each handler.
- Client-callable logic lives in `src/lib/agentic/*.functions.ts` wrapping `*.server.ts`; routes import only `*.functions.ts`.
- Privy mounts through a lazy client-only entry (`ClientOnly` + `Suspense`), never imported at route module scope. Native sponsorship is not used on Base Sepolia; the user approves the signature.
- x402 goes through the same-origin proxy route (the facilitator sends no CORS headers) and uses the v2 envelope shape with CAIP-2 network ids.
- New tables: `agentic_sessions` (transcripts, mandates, order records, per-user RLS) so runs are reviewable in the Activity log. Existing Identus tables are unchanged.
- All four demos honour the demo-fallback contract: no throw at boot for missing config, `simulated: true` surfaced on responses.
- Semantic design tokens only; mobile-first layouts reusing `MonoValue`, `StickyActionBar`, and the console card styling.

## Build order

1. `/demo` shell + Identus mode detection + `agentic_sessions` table.
2. A2A (negotiation base + agent cards + AIsa reasoning + credential proof step).
3. AP2 (Privy mount, EIP-712 mandates, Identus credential mirror, revocation).
4. UCP (merchant route, RFC 9421 signing/verification, conformance self-test).
5. x402 (proxy, challenge/sign/retry/settle, balance + faucet UX).
6. Cross-links from `/learn` and `/docs`, SEO metadata, mobile pass.
