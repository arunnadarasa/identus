/**
 * x402 v2 client: 402 challenge → EIP-3009 authorization → paid retry.
 *
 * Hard-won invariants encoded here:
 *  - all traffic goes through the same-origin proxy (facilitators send no CORS)
 *  - the envelope is v2: { x402Version, accepted, payload } — v1 shapes are
 *    rejected as `invalid_payload`
 *  - network ids are CAIP-2 ("eip155:84532") and the amount field is `amount`
 *  - EIP-712 domain name/version come from requirement.extra, never hardcoded
 */

import x402Cfg from "@/data/x402.json";
import { randomHex } from "./hash";
import { IDENTUS_HEADERS, type GateInfo } from "./x402-mandate";

/** Identus credential + delegation mandate presented to the gate. */
export type IdentusPresentation = {
  credentialJwt?: string | null;
  delegationJwt?: string | null;
};

function identusHeaders(p: IdentusPresentation | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (p?.credentialJwt) headers[IDENTUS_HEADERS.credential] = p.credentialJwt;
  if (p?.delegationJwt) headers[IDENTUS_HEADERS.delegation] = p.delegationJwt;
  return headers;
}

export type { GateInfo };

export type PaymentRequirement = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  resource?: string;
  description?: string;
  maxTimeoutSeconds?: number;
  extra?: { name?: string; version?: string };
};

export type Challenge = {
  x402Version: number;
  accepts: PaymentRequirement[];
  error?: string;
  /** Verdict from our own Identus gate, added in front of the facilitator. */
  identus?: GateInfo;
};

export type SettlementReceipt = {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
};

export async function fetchChallenge(presentation?: IdentusPresentation): Promise<{
  status: number;
  challenge: Challenge | null;
  raw: string;
  gate: GateInfo | null;
}> {
  const res = await fetch(x402Cfg.proxy, { method: "GET", headers: identusHeaders(presentation) });
  const raw = await res.text();
  let challenge: Challenge | null = null;
  try {
    challenge = JSON.parse(raw) as Challenge;
  } catch {
    challenge = null;
  }
  return { status: res.status, challenge, raw, gate: challenge?.identus ?? null };
}

export function pickRequirement(challenge: Challenge | null): PaymentRequirement | null {
  const accepts = challenge?.accepts ?? [];
  return (
    accepts.find((r) => r.network === x402Cfg.network && r.scheme === "exact") ??
    accepts.find((r) => r.scheme === "exact") ??
    accepts[0] ??
    null
  );
}

export function authorizationTypedData(opts: {
  requirement: PaymentRequirement;
  from: `0x${string}`;
}) {
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: opts.from,
    to: opts.requirement.payTo,
    value: opts.requirement.amount,
    validAfter: String(now - 60),
    validBefore: String(now + (opts.requirement.maxTimeoutSeconds ?? 300)),
    nonce: randomHex(32),
  };

  const typedData = {
    domain: {
      name: opts.requirement.extra?.name ?? "USDC",
      version: opts.requirement.extra?.version ?? "2",
      chainId: x402Cfg.chainId,
      verifyingContract: opts.requirement.asset,
    },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  };

  return { typedData, authorization };
}

function b64(input: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(input)));
}

export function buildPaymentHeader(opts: {
  requirement: PaymentRequirement;
  authorization: Record<string, string>;
  signature: `0x${string}`;
}): { header: string; envelope: unknown } {
  const envelope = {
    x402Version: 2,
    accepted: opts.requirement,
    payload: { signature: opts.signature, authorization: opts.authorization },
  };
  return { header: b64(JSON.stringify(envelope)), envelope };
}

export async function fetchPaid(
  paymentHeader: string,
  presentation?: IdentusPresentation,
): Promise<{
  status: number;
  body: string;
  receipt: SettlementReceipt | null;
  receiptRaw: string | null;
  gate: GateInfo | null;
}> {
  const res = await fetch(x402Cfg.proxy, {
    method: "GET",
    headers: { "PAYMENT-SIGNATURE": paymentHeader, ...identusHeaders(presentation) },
  });
  const body = await res.text();
  const receiptRaw = res.headers.get("PAYMENT-RESPONSE");
  let receipt: SettlementReceipt | null = null;
  if (receiptRaw) {
    try {
      receipt = JSON.parse(atob(receiptRaw)) as SettlementReceipt;
    } catch {
      receipt = null;
    }
  }
  let gate: GateInfo | null = null;
  try {
    gate = (JSON.parse(body) as { identus?: GateInfo }).identus ?? null;
  } catch {
    gate = null;
  }
  return { status: res.status, body, receipt, receiptRaw, gate };
}

export function formatUsdc(atomic: string): string {
  const n = Number(atomic);
  if (!Number.isFinite(n)) return atomic;
  return (n / 1e6).toFixed(Math.min(6, 2));
}

export { x402Cfg };
