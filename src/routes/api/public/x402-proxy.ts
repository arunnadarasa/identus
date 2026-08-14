/**
 * Same-origin proxy for the x402 facilitator. Public facilitators send no CORS
 * headers, so a direct browser fetch fails before the 402 is even visible.
 * Forwards PAYMENT-SIGNATURE up and PAYMENT-RESPONSE back, nothing else.
 */
import { createFileRoute } from "@tanstack/react-router";
import x402Cfg from "@/data/x402.json";

async function proxy(request: Request): Promise<Response> {
  const sig = request.headers.get("PAYMENT-SIGNATURE");
  try {
    const upstream = await fetch(x402Cfg.endpoint, {
      method: "GET",
      headers: sig ? { "PAYMENT-SIGNATURE": sig } : {},
    });
    const body = await upstream.arrayBuffer();
    const out = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) out.set("Content-Type", ct);
    const pr = upstream.headers.get("PAYMENT-RESPONSE");
    if (pr) out.set("PAYMENT-RESPONSE", pr);
    out.set("Access-Control-Expose-Headers", "PAYMENT-RESPONSE");
    return new Response(body, { status: upstream.status, headers: out });
  } catch (err) {
    return Response.json(
      {
        error: "facilitator_unreachable",
        detail: err instanceof Error ? err.message : "upstream fetch failed",
      },
      { status: 502 },
    );
  }
}

export const Route = createFileRoute("/api/public/x402-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => proxy(request),
      POST: async ({ request }) => proxy(request),
    },
  },
});
