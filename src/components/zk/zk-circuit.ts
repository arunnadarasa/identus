/**
 * The Noir circuit behind the live zero-knowledge demo at /app/zk.
 *
 * Private inputs stay inside the prover (the holder's browser) and never appear
 * in the proof or its public inputs:
 *  - `dob_year` — the birth year read out of an issued Identus credential.
 *  - `credential_hash_lo` / `credential_hash_hi` — the two 128-bit halves of
 *    SHA-256 over the credential's JWT. This is the credential binding.
 *
 * Public: `threshold_year`, supplied by the verifier, plus the returned
 * commitment — a Pedersen hash of the binding. Because Pedersen is
 * deterministic, a verifier holding the same credential gets the same
 * commitment every time, so the proof is provably about *that* credential
 * while the JWT and the birth year stay hidden.
 */
export const AGE_CIRCUIT_SOURCE = `fn main(
    dob_year: u32,
    credential_hash_lo: Field,
    credential_hash_hi: Field,
    threshold_year: pub u32,
) -> pub Field {
    assert(dob_year <= threshold_year);
    std::hash::pedersen_hash([credential_hash_lo, credential_hash_hi])
}
`;

export const AGE_CIRCUIT_NARGO_TOML = `[package]
name = "age_check"
type = "bin"
authors = [""]

[dependencies]
`;

/**
 * SHA-256 over the credential JWT, split into two field-safe 128-bit limbs.
 * WebCrypto only — the JWT never leaves the page.
 */
export async function credentialBinding(jwt: string): Promise<{ lo: string; hi: string; digest: string }> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jwt)));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    hi: `0x${hex.slice(0, 32)}`,
    lo: `0x${hex.slice(32)}`,
    digest: `0x${hex}`,
  };
}
