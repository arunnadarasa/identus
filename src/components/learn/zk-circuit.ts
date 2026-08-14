/**
 * The Noir circuit used by the live zero-knowledge demo on /learn.
 *
 * `dob_year` is a private input — it stays inside the prover (the visitor's
 * browser) and never appears in the proof or its public inputs.
 * `threshold_year` is public: the verifier supplies it and can read it back.
 *
 * The single assertion is the whole statement: "my birth year is at or before
 * the year that makes me 18". A proof can only exist if that holds.
 */
export const AGE_CIRCUIT_SOURCE = `fn main(dob_year: u32, threshold_year: pub u32) {
    assert(dob_year <= threshold_year);
}
`;

export const AGE_CIRCUIT_NARGO_TOML = `[package]
name = "age_check"
type = "bin"
authors = [""]

[dependencies]
`;
