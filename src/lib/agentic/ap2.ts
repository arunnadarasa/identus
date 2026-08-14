/**
 * AP2 mandate helpers usable on both sides of the wire.
 *
 * Mandates are signed as EIP-712 typed data so a wallet (Privy embedded) can
 * sign them and anyone can recover the signer. The struct fields carry hashes
 * of the canonical JSON, not the JSON itself — that keeps the wallet prompt
 * readable while still binding the exact mandate bytes.
 */

import type { CartMandate, IntentMandate, PaymentMandate } from "./types";
import { jsonHash } from "./hash";

export const AP2_DOMAIN = {
  name: "AP2 Mandate",
  version: "0.1",
  chainId: 84532,
} as const;

export const INTENT_TYPES = {
  IntentMandate: [
    { name: "intentId", type: "string" },
    { name: "buyerDid", type: "string" },
    { name: "goal", type: "string" },
    { name: "sku", type: "string" },
    { name: "maxPrice", type: "string" },
    { name: "expiresAt", type: "string" },
    { name: "payloadHash", type: "string" },
  ],
} as const;

export const CART_TYPES = {
  CartMandate: [
    { name: "cartId", type: "string" },
    { name: "sellerDid", type: "string" },
    { name: "total", type: "string" },
    { name: "intentHash", type: "string" },
    { name: "payloadHash", type: "string" },
  ],
} as const;

export const PAYMENT_TYPES = {
  PaymentMandate: [
    { name: "paymentId", type: "string" },
    { name: "buyerDid", type: "string" },
    { name: "cartHash", type: "string" },
    { name: "amount", type: "string" },
    { name: "network", type: "string" },
  ],
} as const;

export type TypedDataEnvelope = {
  domain: typeof AP2_DOMAIN;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, string>;
};

export async function intentTypedData(intent: IntentMandate): Promise<TypedDataEnvelope> {
  return {
    domain: AP2_DOMAIN,
    types: INTENT_TYPES as unknown as TypedDataEnvelope["types"],
    primaryType: "IntentMandate",
    message: {
      intentId: intent.intentId,
      buyerDid: intent.buyerDid,
      goal: intent.goal,
      sku: intent.sku,
      maxPrice: `${intent.maxPrice.amount} ${intent.maxPrice.currency}`,
      expiresAt: intent.expiresAt,
      payloadHash: await jsonHash(intent),
    },
  };
}

export async function cartTypedData(cart: CartMandate): Promise<TypedDataEnvelope> {
  return {
    domain: AP2_DOMAIN,
    types: CART_TYPES as unknown as TypedDataEnvelope["types"],
    primaryType: "CartMandate",
    message: {
      cartId: cart.cartId,
      sellerDid: cart.sellerDid,
      total: `${cart.total.amount} ${cart.total.currency}`,
      intentHash: cart.intentHash,
      payloadHash: await jsonHash(cart),
    },
  };
}

export function paymentTypedData(mandate: PaymentMandate): TypedDataEnvelope {
  return {
    domain: AP2_DOMAIN,
    types: PAYMENT_TYPES as unknown as TypedDataEnvelope["types"],
    primaryType: "PaymentMandate",
    message: {
      paymentId: mandate.paymentId,
      buyerDid: mandate.buyerDid,
      cartHash: mandate.cartHash,
      amount: `${mandate.amount.amount} ${mandate.amount.currency}`,
      network: mandate.settlement.network,
    },
  };
}

export function buildIntent(opts: {
  buyerDid: string;
  goal: string;
  sku: string;
  quantity: number;
  maxPrice: string;
  currency: string;
  sellerDid: string;
  ttlMinutes?: number;
}): IntentMandate {
  return {
    ap2Version: "0.1",
    intentId: crypto.randomUUID(),
    buyerDid: opts.buyerDid,
    goal: opts.goal,
    sku: opts.sku,
    quantity: opts.quantity,
    maxPrice: { amount: opts.maxPrice, currency: opts.currency },
    expiresAt: new Date(Date.now() + (opts.ttlMinutes ?? 30) * 60_000).toISOString(),
    allowedCounterparties: [opts.sellerDid],
  };
}
