/**
 * The negotiation substrate shared by the A2A seller, the AP2 mandate demo and
 * the UCP merchant: one catalog, one pricing policy, one set of hashes.
 */

import type {
  A2ATask,
  A2ATaskState,
  CartMandate,
  DataPart,
  IntentMandate,
  PaymentRequired,
  PresentationRequest,
} from "./types";
import { MIME } from "./types";

export const CATALOG = [
  {
    sku: "identus-transcript-1y",
    name: "Verified transcript access (1 year)",
    listPrice: "12.00",
    floorPrice: "8.00",
    currency: "EUR",
    /** Discount unlocked by presenting this credential type. */
    discountCredential: "StudentIDCredential",
    discountPrice: "8.00",
  },
  {
    sku: "identus-api-1k",
    name: "1,000 verification API calls",
    listPrice: "25.00",
    floorPrice: "18.00",
    currency: "EUR",
    discountCredential: "StudentIDCredential",
    discountPrice: "18.00",
  },
] as const;

export type CatalogItem = (typeof CATALOG)[number];

export function findItem(sku: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.sku === sku);
}

export { jsonHash, randomHex, stableStringify } from "./hash";
import { jsonHash, randomHex } from "./hash";

export function uuid(): string {
  return crypto.randomUUID();
}

export function dataPart(mimeType: string, data: unknown, metadata?: Record<string, unknown>): DataPart {
  return { kind: "data", mimeType, data, ...(metadata ? { metadata } : {}) };
}

export function findDataPart(parts: DataPart[] | undefined, mimeType: string): DataPart | undefined {
  return (parts ?? []).find((p) => p.mimeType === mimeType);
}

export function money(amount: string): number {
  return Number.parseFloat(amount);
}

/* ------------------------------------------------------------------ */
/* Credential inspection                                               */
/* ------------------------------------------------------------------ */

export type CredentialCheck = {
  ok: boolean;
  reason: string;
  issuer: string | null;
  subject: string | null;
  type: string | null;
  expired: boolean;
};

function b64urlToString(segment: string): string {
  const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") return atob(b64);
  return Buffer.from(b64, "base64").toString("utf8");
}

/**
 * Structural verification of a JWT verifiable credential: signature presence,
 * issuer, subject, type and expiry. Cryptographic verification against the
 * issuer's published DID document happens in the Identus agent (the console's
 * verify action); this is the seller-side gate before it bothers.
 */
export function inspectCredential(jwt: string, expectedType?: string): CredentialCheck {
  const empty: CredentialCheck = {
    ok: false,
    reason: "no credential presented",
    issuer: null,
    subject: null,
    type: null,
    expired: false,
  };
  if (!jwt) return empty;
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[2]) {
    return { ...empty, reason: "not a signed JWT (expected three segments)" };
  }
  try {
    const payload = JSON.parse(b64urlToString(parts[1]!));
    const vc = payload?.vc ?? payload;
    const types: string[] = Array.isArray(vc?.type) ? vc.type : vc?.type ? [vc.type] : [];
    const credentialType = types.find((t) => t !== "VerifiableCredential") ?? types[0] ?? null;
    const exp = typeof payload?.exp === "number" ? payload.exp : null;
    const expired = exp !== null && exp * 1000 < Date.now();
    const issuer =
      typeof payload?.iss === "string"
        ? payload.iss
        : typeof vc?.issuer === "string"
          ? vc.issuer
          : (vc?.issuer?.id ?? null);
    const subject = payload?.sub ?? vc?.credentialSubject?.id ?? null;

    if (expired) {
      return { ok: false, reason: "credential expired", issuer, subject, type: credentialType, expired };
    }
    if (!issuer) {
      return { ok: false, reason: "no issuer in credential", issuer, subject, type: credentialType, expired };
    }
    if (expectedType && credentialType && credentialType !== expectedType) {
      return {
        ok: false,
        reason: `expected ${expectedType}, got ${credentialType}`,
        issuer,
        subject,
        type: credentialType,
        expired,
      };
    }
    return { ok: true, reason: "signature present, issuer known, not expired", issuer, subject, type: credentialType, expired };
  } catch {
    return { ...empty, reason: "credential payload is not valid JSON" };
  }
}

/* ------------------------------------------------------------------ */
/* Task store (in-memory, per worker instance)                         */
/* ------------------------------------------------------------------ */

const tasks = new Map<string, A2ATask>();

export function putTask(task: A2ATask): A2ATask {
  tasks.set(task.id, task);
  return task;
}

export function getTask(id: string): A2ATask | undefined {
  return tasks.get(id);
}

export function newTask(contextId: string, state: A2ATaskState = "submitted"): A2ATask {
  return {
    id: uuid(),
    contextId,
    status: { state, timestamp: new Date().toISOString() },
  };
}

/* ------------------------------------------------------------------ */
/* Seller policy                                                       */
/* ------------------------------------------------------------------ */

export type QuoteDecision =
  | { kind: "quote"; price: string; rationale: string }
  | { kind: "needs-proof"; request: PresentationRequest; rationale: string }
  | { kind: "reject"; rationale: string };

/**
 * Pricing policy. List price is always acceptable. Below list, the seller asks
 * for a credential proof; with a valid proof it drops to the discount price,
 * never below the floor.
 */
export function priceDecision(
  item: CatalogItem,
  intent: IntentMandate,
  proof: CredentialCheck | null,
): QuoteDecision {
  const max = money(intent.maxPrice.amount);
  const list = money(item.listPrice);
  const floor = money(item.floorPrice);

  if (max >= list) {
    return { kind: "quote", price: item.listPrice, rationale: "Buyer's cap covers the list price." };
  }
  if (max < floor) {
    return {
      kind: "reject",
      rationale: `Buyer's cap of ${intent.maxPrice.amount} ${intent.maxPrice.currency} is below the ${item.floorPrice} floor.`,
    };
  }
  if (!proof) {
    return {
      kind: "needs-proof",
      rationale: `Below list price requires a ${item.discountCredential}.`,
      request: {
        requestId: uuid(),
        reason: `Discount pricing requires proof of eligibility (${item.discountCredential}).`,
        credentialType: item.discountCredential,
        requiredClaims: ["id", "type"],
        challenge: randomHex(16),
      },
    };
  }
  if (!proof.ok) {
    return { kind: "reject", rationale: `Presentation rejected: ${proof.reason}.` };
  }
  const price = Math.max(floor, Math.min(max, money(item.discountPrice))).toFixed(2);
  return {
    kind: "quote",
    price,
    rationale: `Eligibility credential verified (${proof.type ?? "credential"}) — discount applied.`,
  };
}

export async function buildCart(
  item: CatalogItem,
  intent: IntentMandate,
  sellerDid: string,
  price: string,
  rationale: string,
): Promise<CartMandate> {
  return {
    ap2Version: "0.1",
    cartId: uuid(),
    intentHash: await jsonHash(intent),
    sellerDid,
    items: [
      {
        sku: item.sku,
        name: item.name,
        quantity: intent.quantity,
        unitPrice: price,
        currency: item.currency,
      },
    ],
    total: {
      amount: (money(price) * intent.quantity).toFixed(2),
      currency: item.currency,
    },
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    rationale,
  };
}

/** USDC on Base Sepolia — the settlement rail the x402 demo uses for real. */
export const SETTLEMENT = {
  network: "eip155:84532",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1234567890AbcdEF1234567890aBcdef12345678",
  decimals: 6,
} as const;

export function paymentRequired(total: string): PaymentRequired {
  const atomic = Math.round(money(total) * 10 ** SETTLEMENT.decimals).toString();
  return {
    scheme: "exact",
    network: SETTLEMENT.network,
    asset: SETTLEMENT.asset,
    payTo: SETTLEMENT.payTo,
    amount: atomic,
    nonce: randomHex(32),
    deadline: Math.floor(Date.now() / 1000) + 900,
  };
}

export const SELLER_PARTS = { MIME, dataPart, findDataPart };
