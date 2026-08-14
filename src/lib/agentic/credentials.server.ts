/**
 * Demo-credential minting for the agentic demos.
 *
 * When the console has a real Identus agent with an issued credential we use
 * that JWT verbatim. When it does not, we mint a structurally identical
 * *unsigned-for-demo* JWT so the negotiation flow still runs end to end — and
 * flag it as simulated everywhere it surfaces, so nobody mistakes it for a
 * cryptographically verified credential.
 */

function b64url(input: string): string {
  const b64 =
    typeof btoa === "function" ? btoa(input) : Buffer.from(input, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function demoCredentialJwt(opts: {
  issuerDid: string;
  subjectDid: string;
  type: string;
  claims?: Record<string, unknown>;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256K", typ: "JWT", kid: `${opts.issuerDid}#assertion-1` };
  const payload = {
    iss: opts.issuerDid,
    sub: opts.subjectDid,
    nbf: now - 60,
    exp: now + 365 * 86400,
    jti: `urn:uuid:${crypto.randomUUID()}`,
    vc: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", opts.type],
      issuer: opts.issuerDid,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: opts.subjectDid,
        ...(opts.claims ?? {}),
      },
    },
  };
  // Deterministic placeholder in the signature position: present and well
  // formed so structural checks pass, never mistakable for a real signature.
  const signature = b64url(`demo-signature-not-cryptographic-${payload.jti}`);
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${signature}`;
}

/** Delegation credential: a human authorising an agent to act with limits. */
export function delegationClaims(opts: {
  humanDid: string;
  agentName: string;
  scope: string[];
  spendLimit: string;
  currency: string;
}) {
  return {
    actsFor: opts.humanDid,
    agentName: opts.agentName,
    scope: opts.scope,
    spendLimit: { amount: opts.spendLimit, currency: opts.currency },
    validUntil: new Date(Date.now() + 30 * 86400_000).toISOString(),
  };
}
