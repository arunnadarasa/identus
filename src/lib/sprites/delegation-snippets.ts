/**
 * Minimal TypeScript for issuing and verifying an agent delegation credential.
 *
 * Client-safe (no server imports) and deliberately dependency-light: the signing
 * uses WebCrypto ES256, which runs unchanged in the browser, in Node 18+, and in
 * the Sprites sandbox. The claim names mirror
 * `src/lib/agentic/x402-mandate.ts`, so what a reader copies from here is what
 * the live x402 gate actually checks.
 */
import {
  DELEGATION_CREDENTIAL_TYPE,
  PAYMENT_SCOPE,
} from "@/lib/agentic/x402-mandate";
import { SDK_PACKAGES } from "./snippets";

export type QuickstartSnippet = {
  id: string;
  label: string;
  /** Snippet name used when loading into the sandbox editor. */
  name: string;
  description: string;
  language: "bash" | "ts";
  code: string;
  /** Only TS snippets can be executed in the sandbox. */
  runnable: boolean;
};

const PINNED_SDK = "6.6.0";

const INSTALL = `# The sandbox pins the SDK so peer deps resolve predictably.
npm i ${SDK_PACKAGES[0]}@${PINNED_SDK}
npm i rxjs elliptic buffer core-js   # runtime peers of the SDK

# Nothing below needs the SDK to sign or verify a mandate — WebCrypto is enough.
# You need the SDK when you want real did:prism DIDs, DIDComm, or agent calls.
`;

const HELPERS = `const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
const b64urlJson = (value: unknown) => b64url(enc.encode(JSON.stringify(value)));
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const decodeJwtPart = (part: string) => JSON.parse(new TextDecoder().decode(fromB64url(part)));`;

const ISSUE = `// Issue a delegation mandate: "this agent may act for me, this narrowly."
${HELPERS}

// 1. The issuer key. In production this is your published did:prism assertion
//    key; here we generate an ephemeral P-256 pair so the snippet is standalone.
const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

// 2. The mandate. Every field is a limit a verifier can enforce later.
const humanDid = "did:prism:alice";
const agentDid = "did:prism:shopping-agent";

const claims = {
  iss: humanDid,
  sub: agentDid,
  nbf: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  vc: {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "${DELEGATION_CREDENTIAL_TYPE}"],
    issuer: humanDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: agentDid,
      actsFor: humanDid,                       // who the agent stands in for
      agentName: "Shopping agent",
      scope: ["${PAYMENT_SCOPE}", "cart:negotiate"], // what it may do
      spendLimit: { amount: "0.50", currency: "USDC" }, // how much, at most
      allowedMerchants: ["0x2a835A505d4Ea32372Cc420d2663b885cE089453"],
      validUntil: new Date(Date.now() + 3600_000).toISOString(),
    },
  },
};

// 3. Sign it as an ES256 JWT — the compact form you put in a header.
const header = { alg: "ES256", typ: "JWT" };
const signingInput = \`\${b64urlJson(header)}.\${b64urlJson(claims)}\`;
const signature = new Uint8Array(
  await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    enc.encode(signingInput),
  ),
);
const mandateJwt = \`\${signingInput}.\${b64url(signature)}\`;

console.log("mandate JWT:", mandateJwt);
console.log("issuer public JWK (publish this so verifiers can check it):", publicJwk);
`;

const VERIFY = `// Verify a mandate before honouring anything the agent asks for.
${HELPERS}

// In production the JWT arrives in a header and the public key comes from the
// issuer's DID document. So this snippet runs on its own, we mint one inline —
// the tamper flag below shows what a failed check looks like.
const TAMPER = false;

const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
const issued = {
  sub: "did:prism:shopping-agent",
  vc: {
    type: ["VerifiableCredential", "${DELEGATION_CREDENTIAL_TYPE}"],
    credentialSubject: {
      id: "did:prism:shopping-agent",
      actsFor: "did:prism:alice",
      scope: ["${PAYMENT_SCOPE}", "cart:negotiate"],
      spendLimit: { amount: "0.50", currency: "USDC" },
      allowedMerchants: ["0x2a835A505d4Ea32372Cc420d2663b885cE089453"],
      validUntil: new Date(Date.now() + 3600_000).toISOString(),
    },
  },
};
const input = \`\${b64urlJson({ alg: "ES256", typ: "JWT" })}.\${b64urlJson(issued)}\`;
const sigBytes = new Uint8Array(
  await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    enc.encode(input),
  ),
);
let mandateJwt = \`\${input}.\${b64url(sigBytes)}\`;
if (TAMPER) {
  // Raise the cap without re-signing — exactly what the signature check catches.
  const parts = mandateJwt.split(".");
  const claims = decodeJwtPart(parts[1]);
  claims.vc.credentialSubject.spendLimit.amount = "9999";
  mandateJwt = \`\${parts[0]}.\${b64urlJson(claims)}.\${parts[2]}\`;
}

const action = {
  presenter: "did:prism:shopping-agent", // authenticated DID of the caller
  scope: "${PAYMENT_SCOPE}",
  amount: "0.01",
  currency: "USDC",
  merchant: "0x2a835A505d4Ea32372Cc420d2663b885cE089453",
};

const [h, p, s] = mandateJwt.split(".");
const claims = decodeJwtPart(p);
const subject = claims.vc?.credentialSubject ?? {};

// 1. Signature — is this mandate authentic and untampered?
const issuerKey = await crypto.subtle.importKey(
  "jwk",
  publicJwk,
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["verify"],
);
const signatureValid = await crypto.subtle.verify(
  { name: "ECDSA", hash: "SHA-256" },
  issuerKey,
  fromB64url(s),
  new TextEncoder().encode(\`\${h}.\${p}\`),
);

// 2. The four checks that actually decide the answer.
const checks = {
  signature: signatureValid,
  rightAgent: subject.id === action.presenter,
  inScope: (subject.scope ?? []).includes(action.scope),
  withinCap:
    Number(action.amount) <= Number(subject.spendLimit?.amount ?? 0) &&
    action.currency === subject.spendLimit?.currency,
  merchantAllowed:
    !subject.allowedMerchants?.length ||
    subject.allowedMerchants.includes(action.merchant),
  notExpired: new Date(subject.validUntil).getTime() > Date.now(),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
console.log("checks:", checks);
console.log(failed.length ? \`REJECT — failed: \${failed.join(", ")}\` : "ACCEPT — mandate covers this action");
`;

const GATE = `// The whole point, in ten lines: refuse before you do the work.
// This is what src/routes/api/public/x402-proxy.ts does in front of the payment
// facilitator — the mandate is checked before any authorization is forwarded.
declare function verifyMandate(jwt: string | null, action: unknown): Promise<{
  ok: boolean;
  reason: string;
}>;

export async function handleAgentRequest(request: Request) {
  const mandate = request.headers.get("X-Identus-Delegation");
  const action = { scope: "${PAYMENT_SCOPE}", amount: "0.01", currency: "USDC" };

  const verdict = await verifyMandate(mandate, action);
  if (!verdict.ok) {
    // Say exactly which limit was breached — a bare 403 is undebuggable.
    return Response.json({ error: "mandate_rejected", detail: verdict.reason }, { status: 403 });
  }

  return Response.json({ ok: true, note: "mandate covered the action, proceeding" });
}

console.log("gate ready — reject on the mandate, not on a hunch");
`;

export const DELEGATION_QUICKSTART: QuickstartSnippet[] = [
  {
    id: "install",
    label: "Install",
    name: "Install the Identus SDK",
    description:
      "Pinned SDK plus its runtime peers. Signing and verifying a mandate needs none of it — WebCrypto is enough.",
    language: "bash",
    code: INSTALL,
    runnable: false,
  },
  {
    id: "issue",
    label: "Issue a mandate",
    name: "Issue a delegation credential",
    description: `Builds a ${DELEGATION_CREDENTIAL_TYPE} subject and signs it as an ES256 JWT.`,
    language: "ts",
    code: ISSUE,
    runnable: true,
  },
  {
    id: "verify",
    label: "Verify a mandate",
    name: "Verify a delegation credential",
    description:
      "Signature, then the four limits that decide the answer: right agent, in scope, within cap, not expired.",
    language: "ts",
    code: VERIFY,
    runnable: true,
  },
  {
    id: "gate",
    label: "Gate a request",
    name: "Gate a request on a mandate",
    description: "The shape of a server handler that rejects before doing the work.",
    language: "ts",
    code: GATE,
    runnable: false,
  },
];
