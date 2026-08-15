import { compile_program, createFileManager } from "@noir-lang/noir_wasm";
import { Noir } from "@noir-lang/noir_js";
const src = `fn main(dob_year: u32, credential_binding: Field, threshold_year: pub u32) -> pub Field {
    assert(dob_year <= threshold_year);
    std::hash::poseidon2::Poseidon2::hash([credential_binding], 1)
}
`;
const toml = `[package]\nname = "age_check"\ntype = "bin"\nauthors = [""]\n\n[dependencies]\n`;
const fm = createFileManager("/");
await fm.writeFile("./src/main.nr", new Blob([src]).stream());
await fm.writeFile("./Nargo.toml", new Blob([toml]).stream());
const compiled = await compile_program(fm);
const noir = new Noir(compiled.program);
const r = await noir.execute({ dob_year: 1995, credential_binding: "0x1234", threshold_year: 2008 });
console.log("returnValue", r.returnValue);
