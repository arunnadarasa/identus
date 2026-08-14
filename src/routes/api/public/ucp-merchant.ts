/**
 * UCP (Universal Commerce Protocol) merchant surface: a signed manifest, a
 * signed catalog, signed quotes and signed orders. Every response carries an
 * RFC 9421 HTTP Message Signature so an agent can prove the merchant produced
 * it. Public by design — UCP clients are external agents — and it serves only
 * demo inventory.
 */
import { createFileRoute } from "@tanstack/react-router";

type Quote = {
  quoteId: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  total: string;
  currency: string;
  discountApplied: boolean;
  expiresAt: string;
};

const quotes = new Map<string, Quote>();

export const Route = createFileRoute("/api/public/ucp-merchant")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { signedJson, publicJwk, UCP_ALG, UCP_KEY_ID, SIGNED_COMPONENTS } = await import(
          "@/lib/agentic/ucp-sign.server"
        );
        const { CATALOG } = await import("@/lib/agentic/negotiation.server");
        const url = new URL(request.url);
        const op = url.searchParams.get("op") ?? "manifest";

        if (op === "catalog") {
          return signedJson(request, {
            ucpVersion: "0.1",
            items: CATALOG.map((i) => ({
              sku: i.sku,
              name: i.name,
              price: i.listPrice,
              currency: i.currency,
              discount: {
                price: i.discountPrice,
                requiresCredentialType: i.discountCredential,
              },
            })),
          });
        }

        if (op === "manifest") {
          return signedJson(request, {
            ucpVersion: "0.1",
            merchant: {
              name: "Identus Demo Merchant",
              legalName: "Identus Companion Demo Ltd",
              contact: "agents@identus.example",
            },
            capabilities: {
              catalog: true,
              quotes: true,
              checkout: true,
              credentialGatedPricing: true,
              settlement: ["x402-exact"],
            },
            endpoints: {
              catalog: `${url.origin}/api/public/ucp-merchant?op=catalog`,
              quote: `${url.origin}/api/public/ucp-merchant`,
              checkout: `${url.origin}/api/public/ucp-merchant`,
            },
            signing: {
              alg: UCP_ALG,
              keyId: UCP_KEY_ID,
              coveredComponents: SIGNED_COMPONENTS,
              jwk: await publicJwk(),
            },
            credentialPolicy: {
              acceptedTypes: ["StudentIDCredential", "AgentDelegationCredential"],
              presentationFormats: ["jwt_vc"],
            },
          });
        }

        return signedJson(request, { error: "unknown_op", op }, 400);
      },

      POST: async ({ request }) => {
        const { signedJson } = await import("@/lib/agentic/ucp-sign.server");
        const {
          findItem,
          inspectCredential,
          money,
          paymentRequired,
          uuid,
          jsonHash,
        } = await import("@/lib/agentic/negotiation.server");

        let body: any;
        try {
          body = await request.json();
        } catch {
          return signedJson(request, { error: "invalid_json" }, 400);
        }

        if (body?.op === "quote") {
          const item = findItem(String(body.sku ?? ""));
          if (!item) return signedJson(request, { error: "unknown_sku", sku: body.sku }, 404);
          const quantity = Math.min(Math.max(Number(body.quantity ?? 1) | 0, 1), 10);
          const check = body.credentialJwt
            ? inspectCredential(String(body.credentialJwt), item.discountCredential)
            : null;
          const discount = Boolean(check?.ok);
          const unitPrice = discount ? item.discountPrice : item.listPrice;
          const quote: Quote = {
            quoteId: uuid(),
            sku: item.sku,
            quantity,
            unitPrice,
            total: (money(unitPrice) * quantity).toFixed(2),
            currency: item.currency,
            discountApplied: discount,
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          };
          quotes.set(quote.quoteId, quote);
          return signedJson(request, {
            ucpVersion: "0.1",
            quote,
            credentialCheck: check,
            paymentRequired: paymentRequired(quote.total),
          });
        }

        if (body?.op === "checkout") {
          const quote = quotes.get(String(body.quoteId ?? ""));
          if (!quote) return signedJson(request, { error: "unknown_quote" }, 404);
          const mandate = body.paymentMandate;
          if (!mandate?.cartHash || !mandate?.buyerDid) {
            return signedJson(request, { error: "payment_mandate_required" }, 400);
          }
          return signedJson(request, {
            ucpVersion: "0.1",
            order: {
              orderId: uuid(),
              quoteId: quote.quoteId,
              buyerDid: mandate.buyerDid,
              total: { amount: quote.total, currency: quote.currency },
              status: "confirmed",
              mandateHash: await jsonHash(mandate),
              confirmedAt: new Date().toISOString(),
            },
          });
        }

        return signedJson(request, { error: "unknown_op", op: body?.op ?? null }, 400);
      },
    },
  },
});
