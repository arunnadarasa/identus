/**
 * Browser-side RFC 9421 verifier for UCP merchant responses.
 *
 * The agent re-derives the signature base from what it actually sent and
 * received (method, URL, status, body digest) and checks the signature against
 * the merchant's published JWK. A mismatch anywhere means the response was not
 * produced by the key in the manifest.
 */

import { sha256Base64 } from "./hash";

export type VerificationStep = {
  label: string;
  ok: boolean;
  detail: string;
};

export type VerificationResult = {
  ok: boolean;
  steps: VerificationStep[];
  keyId: string | null;
  alg: string | null;
  created: number | null;
  signatureBase: string | null;
};

function parseSigInput(header: string | null): {
  params: string;
  keyId: string | null;
  alg: string | null;
  created: number | null;
} | null {
  if (!header) return null;
  const eq = header.indexOf("=");
  if (eq < 0) return null;
  const params = header.slice(eq + 1).trim();
  const keyId = /keyid="([^"]+)"/.exec(params)?.[1] ?? null;
  const alg = /alg="([^"]+)"/.exec(params)?.[1] ?? null;
  const createdRaw = /created=(\d+)/.exec(params)?.[1];
  return { params, keyId, alg, created: createdRaw ? Number(createdRaw) : null };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifySignedResponse(opts: {
  response: Response;
  bodyText: string;
  method: string;
  targetUri: string;
  jwk: Record<string, unknown> | null;
}): Promise<VerificationResult> {
  const steps: VerificationStep[] = [];
  const sigInput = parseSigInput(opts.response.headers.get("Signature-Input"));
  const sigHeader = opts.response.headers.get("Signature");
  const digestHeader = opts.response.headers.get("Content-Digest");

  const fail = (label: string, detail: string): VerificationResult => {
    steps.push({ label, ok: false, detail });
    return {
      ok: false,
      steps,
      keyId: sigInput?.keyId ?? null,
      alg: sigInput?.alg ?? null,
      created: sigInput?.created ?? null,
      signatureBase: null,
    };
  };

  if (!sigInput || !sigHeader || !digestHeader) {
    return fail("Signature headers present", "Missing Signature, Signature-Input or Content-Digest.");
  }
  steps.push({
    label: "Signature headers present",
    ok: true,
    detail: `keyid=${sigInput.keyId}, alg=${sigInput.alg}`,
  });

  const expectedDigest = `sha-256=:${await sha256Base64(opts.bodyText)}:`;
  if (expectedDigest !== digestHeader) {
    return fail("Content-Digest matches body", "The body does not hash to the advertised digest.");
  }
  steps.push({
    label: "Content-Digest matches body",
    ok: true,
    detail: `${digestHeader.slice(0, 26)}… recomputed from ${opts.bodyText.length} bytes`,
  });

  if (!opts.jwk) {
    return fail("Merchant key available", "No public key from the manifest to verify against.");
  }

  const base = [
    `"@status": ${opts.response.status}`,
    `"@method": ${opts.method}`,
    `"@target-uri": ${opts.targetUri}`,
    `"content-digest": ${digestHeader}`,
    `"@signature-params": ${sigInput.params}`,
  ].join("\n");

  let ok = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: opts.jwk["x"] as string, y: opts.jwk["y"] as string, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const sigBytes = b64ToBytes(sigHeader.replace(/^sig1=:/, "").replace(/:$/, ""));
    ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sigBytes as unknown as BufferSource,
      new TextEncoder().encode(base) as unknown as BufferSource,
    );
  } catch (err) {
    return fail(
      "Signature verifies",
      err instanceof Error ? err.message : "verification threw",
    );
  }

  steps.push({
    label: "Signature verifies",
    ok,
    detail: ok
      ? "ECDSA P-256 signature over the reconstructed signature base is valid."
      : "Signature did not verify against the merchant's published key.",
  });

  const skew = sigInput.created ? Math.abs(Date.now() / 1000 - sigInput.created) : null;
  const fresh = skew === null ? false : skew < 300;
  steps.push({
    label: "Timestamp is fresh",
    ok: fresh,
    detail:
      skew === null
        ? "No created parameter."
        : `created ${Math.round(skew)}s ago (tolerance 300s).`,
  });

  return {
    ok: ok && fresh,
    steps,
    keyId: sigInput.keyId,
    alg: sigInput.alg,
    created: sigInput.created,
    signatureBase: base,
  };
}
