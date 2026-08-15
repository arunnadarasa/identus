# Noir circuit patterns

Small circuits for browser proving. Everything below compiles with `noir_wasm` beta 26 and proves in
seconds on one thread. Types: `Field` is a BN254 element (~254 bits); `u32`/`u64` are range-constrained
integers and are what you want for comparisons.

## Range / threshold check

```rust
fn main(dob_year: u32, threshold_year: pub u32) {
    assert(dob_year <= threshold_year);
}
```

Compute `threshold_year = currentYear - 18` outside the circuit and pass it as a public input, so the
verifier chooses the policy and the same circuit serves any age gate. Never make the secret public by
also returning it.

## Commitment so the verifier knows what was proved

```rust
fn main(secret: Field, nonce: Field) -> pub Field {
    std::hash::pedersen_hash([secret, nonce])
}
```

Deterministic: the same `(secret, nonce)` always yields the same commitment, so two proofs can be
linked to one source. Omit the nonce when linkability is desired (as with a credential binding);
include a random nonce when it is not, or the commitment becomes a tracking identifier.

## Binding a proof to a signed document (hash limbs)

```rust
fn main(
    value: u32,
    doc_hash_lo: Field,
    doc_hash_hi: Field,
    threshold: pub u32,
) -> pub Field {
    assert(value <= threshold);
    std::hash::pedersen_hash([doc_hash_lo, doc_hash_hi])
}
```

```ts
// SHA-256 → two 128-bit limbs, WebCrypto only
const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jwt)));
const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const hi = `0x${hex.slice(0, 32)}`;
const lo = `0x${hex.slice(32)}`;
```

A 256-bit digest exceeds the field, so a single `Field` silently wraps. Always split. Hashing inside
the circuit instead (`std::hash::sha256`) proves the digest really comes from the document, but costs
thousands of constraints per block — do it only when the preimage must be constrained.

## Set membership without revealing the member

```rust
fn main(leaf: Field, path: [Field; 4], index: u32, root: pub Field) {
    let mut node = leaf;
    let mut i = index;
    for k in 0..4 {
        let sibling = path[k];
        let (l, r) = if i & 1 == 0 { (node, sibling) } else { (sibling, node) };
        node = std::hash::pedersen_hash([l, r]);
        i = i >> 1;
    }
    assert(node == root);
}
```

Fixed-size arrays only — Noir has no dynamic length. Depth 4 covers 16 leaves; a revocation list needs
depth 20+, which is when proving time starts to matter. Publish the root, keep leaf and path private.

## Equality against a public expectation

```rust
fn main(claim: Field, expected: pub Field) {
    assert(claim == expected);
}
```

Only meaningful when `claim` has enough entropy — a low-cardinality value (a country code, a boolean)
is brute-forceable from the commitment, so this proves nothing private. Salt it or reconsider.

## Constraints and cost

| Operation | Rough cost |
| --- | --- |
| `assert` on `u32` comparison | tens |
| `pedersen_hash` of 2 fields | low hundreds |
| `sha256` per 64-byte block | thousands |
| Merkle path, depth `d` | `d` × pedersen |
| ECDSA / signature verification | tens of thousands — avoid in-browser |

Keep browser circuits under a few thousand constraints. Verify signatures outside the circuit and bind
to their hash instead.

## Rules of thumb

- Every user-facing claim needs a matching `assert` or a public return value. If the UI says "over 18"
  and the circuit has no comparison, the demo is theatre.
- Public inputs are visible in the proof object. Never mark a secret `pub`.
- Integer division and modulo differ from field arithmetic; use `u32`/`u64` for anything arithmetic and
  `Field` for hash inputs.
- Fixed loop bounds only — the bound must be a compile-time constant.
- Test the negative case: inputs that should fail must throw during witness generation, not produce a
  proof that verifies.
