import { Barretenberg, Fr } from "@aztec/bb.js";
const api = await Barretenberg.new({ threads: 1 });
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(api)).join(","));
