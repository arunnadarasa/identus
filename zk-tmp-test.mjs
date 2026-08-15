import { compile_program, createFileManager } from "@noir-lang/noir_wasm";
import { Noir } from "@noir-lang/noir_js";
const cands = [
 "std::hash::poseidon2::hash([credential_binding], 1)",
 "std::hash::poseidon2_permutation([credential_binding, 0, 0, 0], 4)[0]",
 "std::hash::blake3(credential_binding.to_be_bytes::<32>())[0] as Field",
 "std::hash::pedersen_hash([credential_binding])",
 "std::hash::keccak256(credential_binding.to_be_bytes::<32>(), 32)[0] as Field",
];
const toml = `[package]\nname = "age_check"\ntype = "bin"\nauthors = [""]\n\n[dependencies]\n`;
for (const c of cands) {
  const src = `fn main(dob_year: u32, credential_binding: Field, threshold_year: pub u32) -> pub Field {\n    assert(dob_year <= threshold_year);\n    ${c}\n}\n`;
  const fm = createFileManager("/");
  await fm.writeFile("./src/main.nr", new Blob([src]).stream());
  await fm.writeFile("./Nargo.toml", new Blob([toml]).stream());
  try {
    const compiled = await compile_program(fm);
    const noir = new Noir(compiled.program);
    const r = await noir.execute({ dob_year: 1995, credential_binding: "0x1234", threshold_year: 2008 });
    console.log("OK", c, "->", r.returnValue);
  } catch (e) { console.log("FAIL", c, String(e.message).split("\n")[0]); }
}
