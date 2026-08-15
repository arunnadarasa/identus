/**
 * Identus-aware gate in front of the x402 facilitator.
 *
 * Two jobs:
 *  1. CORS/transport — public facilitators send no CORS headers, so a direct
 *     browser fetch fails before the 402 is even visible. We forward
 *     PAYMENT-SIGNATURE up and PAYMENT-RESPONSE back.
 *  2. Identity — x402 answers "can this agent pay". Identus answers "who is it
 *     and who authorised it". Without a verified eligibility credential the gate
 *     quotes the list tier and refuses to forward; without a delegation mandate
 *     covering the exact amount, merchant and scope, the payment is rejected
 *     before the wallet's authorization ever reaches the facilitator.
 *
 * The tier quotes are this gate's policy. The amount settled on Base Sepolia is
 * whatever the facilitator's own requirement says — the UI states that plainly.
 */
import { createFileRoute } from "@tanstack/react-router";
import x402Cfg from "@/data/x402.json";
import {
  DELEGATION_CREDENTIAL_TYPE,
  IDENTUS_HEADERS,
  PAYMENT_SCOPE,
  PRICE_TIERS,
  REQUIRED_CREDENTIAL_TYPE,
  checkMandateCoverage,
  inspectCredential,
  type GateInfo,
} from "@/lib/agentic/x402-mandate";

const SETTLED_NOTE =
  "Tier quotes are the Identus gate's policy. The on-chain amount is fixed by the facilitator's own requirement.";

function baseGate(tier: "list" | "member"): Omit<GateInfo, "gate" | "reason"> {
  return {
    requiredCredentialType: REQUIRED_CREDENTIAL_TYPE,
    requiredScope: PAYMENT_SCOPE,
    tier,
    quote: tier === "member" ? PRICE_TIERS.member : PRICE_TIERS.list,
    currency: PRICE_TIERS.currency,
    settledAmountNote: SETTLED_NOTE,
  };
}

function jsonWithGate(status: number, body: unknown, gate: GateInfo): Response {
  return Response.json({ ...(body as object), identus: gate }, {
    status,
    headers: { "Access-Control-Expose-Headers": "PAYMENT-RESPONSE" },
  });
}

function decodeEnvelope(header: string): any | null {
  try {
    const json =
      typeof atob === "function"
        ? atob(header)
        : Buffer.from(header, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function upstreamChallenge(): Promise<{ status: number; body: any; raw: string }> {
  const res = await fetch(x402Cfg.endpoint, { method: "GET" });
  const raw = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = { error: "unparsable_challenge", raw: raw.slice(0, 800) };
  }
  return { status: res.status, body, raw };
}

async function gate(request: Request): Promise<Response> {
  const sig = request.headers.get("PAYMENT-SIGNATURE");
  const credentialJwt = request.headers.get(IDENTUS_HEADERS.credential);
  const delegationJwt = request.headers.get(IDENTUS_HEADERS.delegation);
  const agentDid = request.headers.get(IDENTUS_HEADERS.agent);

  const credential = inspectCredential(credentialJwt, REQUIRED_CREDENTIAL_TYPE);
  const credentialTrace = {
    issuer: credential.issuer,
    subject: credential.subject,
    type: credential.type,
    expiresAt: credential.expiresAt,
  };

  try {
    /* ---------- Challenge phase: no payment attached ---------- */
    if (!sig) {
      const challenge = await upstreamChallenge();

      if (!credentialJwt) {
        return jsonWithGate(402, challenge.body, {
          ...baseGate("list"),
          gate: "credential_required",
          reason: `Present a ${REQUIRED_CREDENTIAL_TYPE} to unlock the member price. Payments are not forwarded without one.`,
        });
      }
      if (!credential.ok) {
        return jsonWithGate(402, challenge.body, {
          ...baseGate("list"),
          gate: "credential_invalid",
          reason: `Credential rejected: ${credential.reason}.`,
          credential: credentialTrace,
        });
      }
      return jsonWithGate(402, challenge.body, {
        ...baseGate("member"),
        gate: "credential_verified",
        reason: `${credential.type} verified (issuer ${credential.issuer}) — member price applies.`,
        credential: credentialTrace,
      });
    }

    /* ---------- Payment phase: credential then mandate ---------- */
    if (!credential.ok) {
      return jsonWithGate(
        402,
        { error: credentialJwt ? "credential_invalid" : "credential_required" },
        {
          ...baseGate("list"),
          gate: credentialJwt ? "credential_invalid" : "credential_required",
          reason: credentialJwt
            ? `Credential rejected: ${credential.reason}. Nothing was forwarded to the facilitator.`
            : `No ${REQUIRED_CREDENTIAL_TYPE} presented. Nothing was forwarded to the facilitator.`,
          ...(credentialJwt ? { credential: credentialTrace } : {}),
        },
      );
    }

    const envelope = decodeEnvelope(sig);
    const authorization = envelope?.payload?.authorization ?? {};
    const amountAtomic = String(authorization?.value ?? envelope?.accepted?.amount ?? "0");
    const payTo = String(authorization?.to ?? envelope?.accepted?.payTo ?? "");
    const payerWallet = typeof authorization?.from === "string" ? authorization.from : null;

    const verdict = checkMandateCoverage({
      jwt: delegationJwt,
      amountAtomic,
      payTo,
      payerWallet,
      expectedSubject: credential.subject,
    });

    if (!verdict.ok) {
      return jsonWithGate(
        403,
        {
          error: verdict.outcome,
          detail: verdict.reason,
          requiredCredentialType: DELEGATION_CREDENTIAL_TYPE,
          requiredScope: PAYMENT_SCOPE,
        },
        {
          ...baseGate("member"),
          gate: verdict.outcome,
          reason: verdict.reason,
          credential: credentialTrace,
          mandate: verdict.mandate,
        },
      );
    }

    /* ---------- Covered: forward to the facilitator ---------- */
    const upstream = await fetch(x402Cfg.endpoint, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": sig },
    });
    const body = await upstream.arrayBuffer();
    const out = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) out.set("Content-Type", ct);
    const pr = upstream.headers.get("PAYMENT-RESPONSE");
    if (pr) out.set("PAYMENT-RESPONSE", pr);
    out.set("X-Identus-Gate", "mandate_ok");
    out.set("Access-Control-Expose-Headers", "PAYMENT-RESPONSE, X-Identus-Gate");
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
      GET: async ({ request }) => gate(request),
      POST: async ({ request }) => gate(request),
    },
  },
});
