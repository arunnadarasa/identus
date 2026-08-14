/**
 * Shared types for the agentic-commerce demos.
 *
 * The MIME strings are load-bearing: buyer and seller both pattern-match on
 * them when reading A2A DataParts. Never change one side alone.
 */

export const MIME = {
  intent: "application/vnd.ap2.mandate.intent+json",
  cart: "application/vnd.ap2.mandate.cart+json",
  payment: "application/vnd.ap2.mandate.payment+json",
  paymentRequired: "application/vnd.x402.payment-required+json",
  presentationRequest: "application/vnd.identus.presentation-request+json",
  presentation: "application/vnd.identus.presentation+json",
  fulfilment: "application/vnd.identus.access-grant+json",
} as const;

export type A2ATaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "rejected"
  | "failed";

export type DataPart = {
  kind: "data";
  mimeType: string;
  data: unknown;
  metadata?: Record<string, unknown>;
};

export type A2AMessage = {
  role: "user" | "agent";
  parts: DataPart[];
  messageId: string;
};

export type A2ATask = {
  id: string;
  contextId: string;
  status: {
    state: A2ATaskState;
    timestamp: string;
    message?: A2AMessage;
    reason?: string;
  };
  artifacts?: { name: string; parts: DataPart[] }[];
};

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string;
  method: "message/send" | "tasks/get" | "tasks/cancel";
  params: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
};

/** AP2 mandates (ap2Version 0.1). */
export type IntentMandate = {
  ap2Version: "0.1";
  intentId: string;
  buyerDid: string;
  goal: string;
  sku: string;
  quantity: number;
  maxPrice: { amount: string; currency: string };
  expiresAt: string;
  allowedCounterparties: string[];
};

export type CartLineItem = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  currency: string;
};

export type CartMandate = {
  ap2Version: "0.1";
  cartId: string;
  intentHash: string;
  sellerDid: string;
  items: CartLineItem[];
  total: { amount: string; currency: string };
  expiresAt: string;
  rationale?: string;
};

export type PaymentMandate = {
  ap2Version: "0.1";
  paymentId: string;
  cartHash: string;
  buyerDid: string;
  amount: { amount: string; currency: string };
  settlement: { scheme: string; network: string; txHash?: string };
  signature?: string;
  signedBy?: string;
};

export type PaymentRequired = {
  scheme: "exact";
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  nonce: string;
  deadline: number;
};

export type PresentationRequest = {
  requestId: string;
  reason: string;
  credentialType: string;
  requiredClaims: string[];
  challenge: string;
};

export type TranscriptEntry = {
  step: number;
  label: string;
  actor: "buyer" | "seller" | "human" | "verifier";
  detail: string;
  envelope?: unknown;
  state?: A2ATaskState;
  simulated?: boolean;
};

/** The identity context every demo runs under. */
export type AgenticIdentity = {
  mode: "simulated" | "docker" | "fly" | null;
  simulated: boolean;
  reason: string;
  buyerDid: string;
  sellerDid: string;
  buyerLabel: string;
  sellerLabel: string;
  credentialJwt: string | null;
  credentialType: string;
};
