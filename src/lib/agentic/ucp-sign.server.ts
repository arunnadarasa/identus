/**
 * RFC 9421 HTTP Message Signatures for the UCP merchant demo.
 *
 * WebCrypto ECDSA P-256 (`ecdsa-p256-sha256`). The key pair is generated per
 * worker instance and its public JWK is published in the manifest, which is
 * what lets the browser-side agent verify responses without any shared secret.
 */

import { sha256Base64 } from "./hash";

export const UCP_KEY_ID = "ucp-demo-key-1";
export const UCP_ALG = "ecdsa-p256-sha256";
export const SIGNED_COMPONENTS = ["@status", "@method", "@target-uri", "content-digest"] as const;

let keyPromise: Promise<CryptoKeyPair> | null = null;

function getKeys(): Promise<CryptoKeyPair> {
  keyPromise ??= crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;
  return keyPromise;
}

export async function publicJwk(): Promise<Record<string, unknown>> {
  const { publicKey } = await getKeys();
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return { ...(jwk as Record<string, unknown>), kid: UCP_KEY_ID, alg: "ES256", use: "sig" };
}

export function signatureParams(created: number): string {
  const components = SIGNED_COMPONENTS.map((c) => `"${c}"`).join(" ");
  return `(${components});created=${created};keyid="${UCP_KEY_ID}";alg="${UCP_ALG}"`;
}

/** The exact byte string both signer and verifier must reproduce. */
export function signatureBase(input: {
  status: number;
  method: string;
  targetUri: string;
  contentDigest: string;
  params: string;
}): string {
  return [
    `"@status": ${input.status}`,
    `"@method": ${input.method}`,
    `"@target-uri": ${input.targetUri}`,
    `"content-digest": ${input.contentDigest}`,
    `"@signature-params": ${input.params}`,
  ].join("\n");
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64");
}

/**
 * Signed JSON response. Adds `Content-Digest`, `Signature-Input` and
 * `Signature`, and exposes them to the browser so a same-origin agent can read
 * and verify them.
 */
export async function signedJson(
  request: Request,
  body: unknown,
  status = 200,
): Promise<Response> {
  const payload = JSON.stringify(body);
  const contentDigest = `sha-256=:${await sha256Base64(payload)}:`;
  const created = Math.floor(Date.now() / 1000);
  const params = signatureParams(created);
  const base = signatureBase({
    status,
    method: request.method,
    targetUri: request.url,
    contentDigest,
    params,
  });

  const { privateKey } = await getKeys();
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      new TextEncoder().encode(base) as unknown as BufferSource,
    ),
  );

  return new Response(payload, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Content-Digest": contentDigest,
      "Signature-Input": `sig1=${params}`,
      Signature: `sig1=:${b64(sig)}:`,
      "Access-Control-Expose-Headers": "Content-Digest, Signature-Input, Signature",
    },
  });
}
