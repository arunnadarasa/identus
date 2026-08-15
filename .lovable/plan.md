# Move the live ZK proof demo into the console

The hands-on zero-knowledge prover moves out of the public /learn page and becomes its own console page. The /learn explainer stays as-is and points people to the console.

## What changes

**New console page: Zero-knowledge**
- New route at `/app/zk`, listed in the console nav (desktop and mobile menu) after "Agentic demos".
- Contains the live "Prove I'm over 18" panel: real Noir circuit compiled in the browser, UltraHonk proof generated and verified, step-by-step log, and the "Tamper" button.
- Short intro copy plus a note that the proof runs entirely in the browser and needs no agent, so it works in any mode (simulated, docker, Fly).
- Own page metadata (title, description, og tags).

**/learn keeps the explanation**
- The "standard credential vs ZK" toggle and the three opportunity cards stay in the `#zk` section.
- The live prover is removed from that section and replaced with a call-to-action linking to the console page (signed-in users land on the demo; the section nav entry stays).

## Technical notes

- The demo components (`ZkProofLive.tsx`, `zk-proof-client-entry.tsx`, `zk-circuit.ts`) move from `src/components/learn/` to `src/components/zk/`; imports updated. The vendor-asset loading of the Noir compiler stays exactly as it is — no bundler config changes.
- `src/components/learn/ZkProof.tsx` keeps `ProofCompare` and the opportunity grid, drops the `ZkProofLive` render, and gains the console link.
- The new route sets `ssr: false` (same as Sandbox) so the WASM-heavy client entry never touches the SSR graph.
- Mobile-first layout consistent with other console pages.
