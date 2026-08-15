import { Barretenberg } from "@aztec/bb.js";
const api = await Barretenberg.new({ threads: 1 });
const names = [];
let p = Object.getPrototypeOf(api);
while (p && p !== Object.prototype) { names.push(...Object.getOwnPropertyNames(p)); p = Object.getPrototypeOf(p); }
console.log(names.filter(n => /hash|pedersen|poseidon/i.test(n)).join(","));
console.log(Object.keys(api).join(","));
