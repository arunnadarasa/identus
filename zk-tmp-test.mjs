import { compile_program, createFileManager } from "@noir-lang/noir_wasm";
import { Noir } from "@noir-lang/noir_js";
const src = `fn main(
    dob_year: u32,
    credential_hash_lo: Field,
    credential_hash_hi: Field,
    threshold_year: pub u32,
) -> pub Field {
    assert(dob_year <= threshold_year);
    std::hash::pedersen_hash([credential_hash_lo, credential_hash_hi])
}
`;
const toml = `[package]\nname = "age_check"\ntype = "bin"\nauthors = [""]\n\n[dependencies]\n`;
const fm = createFileManager("/");
await fm.writeFile("./src/main.nr", new Blob([src]).stream());
await fm.writeFile("./Nargo.toml", new Blob([toml]).stream());
const compiled = await compile_program(fm);
const noir = new Noir(compiled.program);
const r = await noir.execute({ dob_year: 1995, credential_hash_lo: "0x1122334455667788990011223344556677", credential_hash_hi: "0xaabb", threshold_year: 2008 });
console.log("returnValue", r.returnValue);
const r2 = await noir.execute({ dob_year: 1995, credential_hash_lo: "0x1122334455667788990011223344556677", credential_hash_hi: "0xaabb", threshold_year: 2008 });
console.log("deterministic", r.returnValue === r2.returnValue);
try { await noir.execute({ dob_year: 2015, credential_hash_lo: "0x1", credential_hash_hi: "0x2", threshold_year: 2008 }); console.log("BAD: under-18 accepted"); }
catch (e) { console.log("under-18 rejected ok"); }
