/**
 * Shared rules for the Identus gate that sits in front of the x402 facilitator.
 *
 * Client- and server-safe: no server-only imports, so the demo UI and the gate
 * route reason about exactly the same policy.
 *
 * Honest boundary: the upstream testnet facilitator quotes a fixed price, so the
 * tiers below are *our gate's policy quote*. The amount actually settled on Base
 * Sepolia is whatever the facilitator's requirement says — the UI states this.
 */

export const REQUIRED_CREDENTIAL_TYPE = "StudentIDCredential";
export const DELEGATION_CREDENTIAL_TYPE = "AgentDelegationCredential";
export const PAYMENT_SCOPE = "payment:x402";

/** Gate policy quote, in USDC. */
export const PRICE_TIERS = {
  list: "0.05",
  member: "0.01",
  currency: "USDC",
} as const;

export const IDENTUS_HEADERS = {
  credential: "X-Identus-Credential",
  delegation: "X-Identus-Delegation",
} as const;

export type GateOutcome =
  | "credential_required"
  | "credential_invalid"
  | "credential_verified"
  | "mandate_required"
  | "mandate_invalid"
  | "mandate_expired"
  | "scope_not_granted"
  | "wrong_principal"
  | "wrong_subject"
  | "merchant_not_allowed"
  | "over_spend_limit"
  | "mandate_ok";

export type GateInfo = {
  gate: GateOutcome;
  reason: string;
  requiredCredentialType: string;
  requiredScope: string;
  tier: "list" | "member";
  quote: string;
  currency: string;
  credential?: {
    issuer: string | null;
    subject: string | null;
    type: string | null;
    expiresAt: string | null;
  };
  mandate?: DelegationMandate | null;
  settledAmountNote?: string;
};

export type DelegationMandate = {
  actsFor: string | null;
  agentDid: string | null;
  agentName: string | null;
  scope: string[];
  spendLimit: { amount: string; currency: string } | null;
  payerWallet: string | null;
  allowedMerchants: string[];
  validUntil: string | null;
};

/* ------------------------------------------------------------------ */
/* Isomorphic JWT payload decoding                                     */
/* ------------------------------------------------------------------ */

function fromBase64(b64: string): string {
  if (typeof atob === "function") return atob(b64);
  return Buffer.from(b64, "base64").toString("utf8");
}

export function decodeJwtPayload(jwt: string): any | null {
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[1] || !parts[2]) return null;
  const seg = parts[1]!;
  const pad = seg.length % 4 === 0 ? "" : "=".repeat(4 - (seg.length % 4));
  try {
    return JSON.parse(fromBase64(seg.replace(/-/g, "+").replace(/_/g, "/") + pad));
  } catch {
    return null;
  }
}

export type CredentialInspection = {
  ok: boolean;
  reason: string;
  issuer: string | null;
  subject: string | null;
  type: string | null;
  expiresAt: string | null;
  claims: any;
};

/**
 * Structural verification: three JWT segments, known issuer, matching type, not
 * expired. Cryptographic verification against the issuer's published DID
 * document happens in the Identus agent, not here.
 */
export function inspectCredential(
  jwt: string | null,
  expectedType?: string,
): CredentialInspection {
  const empty: CredentialInspection = {
    ok: false,
    reason: "no credential presented",
    issuer: null,
    subject: null,
    type: null,
    expiresAt: null,
    claims: {},
  };
  if (!jwt) return empty;

  const payload = decodeJwtPayload(jwt);
  if (!payload) return { ...empty, reason: "not a signed JWT (expected three segments)" };

  const vc = payload.vc ?? payload;
  const types: string[] = Array.isArray(vc?.type) ? vc.type : vc?.type ? [vc.type] : [];
  const type = types.find((t) => t !== "VerifiableCredential") ?? types[0] ?? null;
  const issuer =
    typeof payload.iss === "string"
      ? payload.iss
      : typeof vc?.issuer === "string"
        ? vc.issuer
        : (vc?.issuer?.id ?? null);
  const subject = payload.sub ?? vc?.credentialSubject?.id ?? null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const expiresAt = exp === null ? null : new Date(exp * 1000).toISOString();
  const claims: any = vc?.credentialSubject ?? {};

  if (exp !== null && exp * 1000 < Date.now())
    return { ok: false, reason: "credential expired", issuer, subject, type, expiresAt, claims };
  if (!issuer)
    return { ok: false, reason: "no issuer in credential", issuer, subject, type, expiresAt, claims };
  if (expectedType && type !== expectedType)
    return {
      ok: false,
      reason: `expected ${expectedType}, got ${type ?? "no type"}`,
      issuer,
      subject,
      type,
      expiresAt,
      claims,
    };

  return {
    ok: true,
    reason: "signature present, issuer known, type matches, not expired",
    issuer,
    subject,
    type,
    expiresAt,
    claims,
  };
}

export function readMandate(jwt: string | null): DelegationMandate | null {
  const inspection = inspectCredential(jwt);
  if (!jwt || !inspection.type) return null;
  const c: any = inspection.claims;
  return {
    actsFor: typeof c.actsFor === "string" ? c.actsFor : null,
    agentDid: inspection.subject ?? null,
    agentName: typeof c.agentName === "string" ? c.agentName : null,
    scope: Array.isArray(c.scope) ? c.scope.filter((s: unknown) => typeof s === "string") : [],
    spendLimit:
      c.spendLimit && typeof c.spendLimit.amount === "string"
        ? { amount: c.spendLimit.amount, currency: String(c.spendLimit.currency ?? "USDC") }
        : null,
    payerWallet: typeof c.payerWallet === "string" ? c.payerWallet : null,
    allowedMerchants: Array.isArray(c.allowedMerchants)
      ? c.allowedMerchants.filter((m: unknown) => typeof m === "string")
      : [],
    validUntil: typeof c.validUntil === "string" ? c.validUntil : null,
  };
}

/** USDC atomic units (6 decimals) from a decimal string. */
export function toAtomic(amount: string, decimals = 6): bigint {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return 0n;
  }
}

export type MandateVerdict = {
  ok: boolean;
  outcome: GateOutcome;
  reason: string;
  mandate: DelegationMandate | null;
};

/**
 * Does the delegation mandate cover this exact payment? Principal, agent,
 * scope, spend cap, expiry and merchant all have to line up before anything is
 * forwarded.
 *
 * Two distinct identities are in play and must not be conflated:
 *   - `expectedPrincipal` — the human who presented the eligibility credential.
 *     The mandate's `actsFor` has to match them.
 *   - `expectedAgent` — the AI agent the mandate was issued to (its subject).
 *     Optional; only checked when the caller knows which agent is paying.
 */
export function checkMandateCoverage(opts: {
  jwt: string | null;
  amountAtomic: string;
  payTo: string;
  payerWallet?: string | null;
  expectedPrincipal?: string | null;
  expectedAgent?: string | null;
}): MandateVerdict {
  if (!opts.jwt)
    return {
      ok: false,
      outcome: "mandate_required",
      reason: "No delegation credential presented — the gate will not forward an unauthorised payment.",
      mandate: null,
    };

  const inspection = inspectCredential(opts.jwt, DELEGATION_CREDENTIAL_TYPE);
  const mandate = readMandate(opts.jwt);
  if (!inspection.ok || !mandate) {
    const expired = inspection.reason === "credential expired";
    return {
      ok: false,
      outcome: expired ? "mandate_expired" : "mandate_invalid",
      reason: `Delegation credential rejected: ${inspection.reason}.`,
      mandate,
    };
  }

  if (!mandate.actsFor)
    return {
      ok: false,
      outcome: "mandate_invalid",
      reason: "Delegation credential has no actsFor claim, so no human is accountable for the spend.",
      mandate,
    };

  if (mandate.validUntil && Date.parse(mandate.validUntil) < Date.now())
    return {
      ok: false,
      outcome: "mandate_expired",
      reason: `Mandate expired at ${mandate.validUntil}.`,
      mandate,
    };

  if (opts.expectedPrincipal && mandate.actsFor && mandate.actsFor !== opts.expectedPrincipal)
    return {
      ok: false,
      outcome: "wrong_principal",
      reason: `Mandate acts for ${mandate.actsFor}, but the eligibility credential was presented by ${opts.expectedPrincipal}.`,
      mandate,
    };

  if (opts.expectedAgent && mandate.agentDid && mandate.agentDid !== opts.expectedAgent)
    return {
      ok: false,
      outcome: "wrong_subject",
      reason: `Mandate was issued to agent ${mandate.agentDid}, but the payment came from agent ${opts.expectedAgent}.`,
      mandate,
    };

  if (
    mandate.payerWallet &&
    opts.payerWallet &&
    mandate.payerWallet.toLowerCase() !== opts.payerWallet.toLowerCase()
  )
    return {
      ok: false,
      outcome: "wrong_subject",
      reason: `Mandate binds wallet ${mandate.payerWallet}, but the authorization is signed by ${opts.payerWallet}.`,
      mandate,
    };

  if (!mandate.scope.includes(PAYMENT_SCOPE))
    return {
      ok: false,
      outcome: "scope_not_granted",
      reason: `Mandate scope [${mandate.scope.join(", ") || "empty"}] does not include ${PAYMENT_SCOPE}.`,
      mandate,
    };

  if (
    mandate.allowedMerchants.length > 0 &&
    !mandate.allowedMerchants.some((m) => m.toLowerCase() === opts.payTo.toLowerCase())
  )
    return {
      ok: false,
      outcome: "merchant_not_allowed",
      reason: `Merchant ${opts.payTo} is not in the mandate's allowed list.`,
      mandate,
    };

  if (!mandate.spendLimit)
    return {
      ok: false,
      outcome: "mandate_invalid",
      reason: "Mandate carries no spendLimit, so the gate cannot bound the payment.",
      mandate,
    };

  let requested: bigint;
  try {
    requested = BigInt(opts.amountAtomic);
  } catch {
    return {
      ok: false,
      outcome: "mandate_invalid",
      reason: `Authorization amount ${opts.amountAtomic} is not an integer in atomic units.`,
      mandate,
    };
  }

  const cap = toAtomic(mandate.spendLimit.amount);
  if (requested > cap)
    return {
      ok: false,
      outcome: "over_spend_limit",
      reason: `Payment of ${formatAtomic(String(requested))} ${PRICE_TIERS.currency} exceeds the mandate cap of ${mandate.spendLimit.amount} ${mandate.spendLimit.currency}.`,
      mandate,
    };

  return {
    ok: true,
    outcome: "mandate_ok",
    reason: `Mandate covers ${formatAtomic(String(requested))} of ${mandate.spendLimit.amount} ${mandate.spendLimit.currency}, scope ${PAYMENT_SCOPE}, on behalf of ${mandate.actsFor}.`,
    mandate,
  };
}

export function formatAtomic(atomic: string, decimals = 6): string {
  const n = Number(atomic);
  if (!Number.isFinite(n)) return atomic;
  return (n / 10 ** decimals).toFixed(2);
}
