# Swap x402 demo to Alchemy Base Sepolia RPC

## Context
The x402 settlement demo (`/app/demos/x402`) reads the user's USDC balance on Base Sepolia via a viem public client. It currently uses the public `https://sepolia.base.org` RPC, which rate-limits and causes `balanceOf` calls to flake. The user has an Alchemy Base Sepolia RPC URL.

## Change
Update **one field** in `src/data/x402.json`:

```diff
-  "rpcUrl": "https://sepolia.base.org",
+  "rpcUrl": "https://base-sepolia.g.alchemy.com/v2/e-b8dKqY5geCHGIk_B7wl",
```

No other files change — the demo route already reads `x402Cfg.rpcUrl` and passes it to `http()` in the viem client. The proxy route does not use the RPC (it only forwards to the facilitator), so it's unaffected.

## Why in-file
Alchemy keys are publishable and safe in the client bundle, so storing the URL in the committed JSON config (rather than a secret) is the correct approach and matches the skill guidance.
