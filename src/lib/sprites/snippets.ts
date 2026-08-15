/** Starter snippets seeded into a new scratch box. Client-safe (no server imports). */
export interface StarterSnippet {
  name: string;
  description: string;
  code: string;
}

export const SDK_PACKAGES = [
  "@hyperledger/identus-edge-agent-sdk",
  "@hyperledger/identus-sdk",
];

export const STARTER_SNIPPETS: StarterSnippet[] = [
  {
    name: "Create a Peer DID",
    description: "Builds an in-memory Apollo/Castor stack and mints a did:peer.",
    code: `import SDK from "@hyperledger/identus-edge-agent-sdk";

const apollo = new SDK.Apollo();
const castor = new SDK.Castor(apollo);

const authKey = apollo.createPrivateKey({
  type: SDK.Domain.KeyTypes.EC,
  curve: SDK.Domain.Curve.ED25519,
});
const agreementKey = apollo.createPrivateKey({
  type: SDK.Domain.KeyTypes.Curve25519,
  curve: SDK.Domain.Curve.X25519,
});

const did = await castor.createPeerDID(
  [authKey.publicKey(), agreementKey.publicKey()],
  [],
);

console.log("peer DID:", did.toString());

// The "deprecated parameters for initSync()" line above is a harmless WASM
// warning from the SDK, not an error.
const resolved = await castor.resolveDID(did.toString());

// A resolved document exposes its verification methods through coreProperties,
// not a top-level verificationMethod array.
const methods = (resolved.coreProperties ?? []).flatMap((prop) =>
  Array.isArray(prop?.values) ? prop.values : [],
);
console.log("verification methods:", methods.length);
console.log("first method id:", methods[0]?.id ?? "(none)");
console.log(JSON.stringify(resolved, null, 2).slice(0, 1200));
`,
  },
  {
    name: "Agent health & version",
    description: "Raw fetch against the active agent to confirm connectivity.",
    code: `const base = process.env.AGENT_BASE_URL;
const key = process.env.AGENT_API_KEY;

const res = await fetch(base + "/_system/health", {
  headers: key ? { apikey: key } : {},
});
console.log("status:", res.status);
console.log("body:", await res.text());
`,
  },
  {
    name: "Publish a PRISM DID",
    description: "Creates an unpublished did:prism through the DID registrar, then publishes it.",
    code: `const base = process.env.AGENT_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  ...(process.env.AGENT_API_KEY ? { apikey: process.env.AGENT_API_KEY } : {}),
};

const created = await fetch(base + "/did-registrar/dids", {
  method: "POST",
  headers,
  body: JSON.stringify({
    documentTemplate: {
      publicKeys: [{ id: "auth-1", purpose: "authentication" }],
      services: [],
    },
  }),
}).then((r) => r.json());

console.log("longFormDid:", created.longFormDid);

const published = await fetch(
  base + "/did-registrar/dids/" + created.longFormDid + "/publications",
  { method: "POST", headers },
).then((r) => r.json());

console.log("publication:", JSON.stringify(published, null, 2));
`,
  },
  {
    name: "Create a connection invitation",
    description: "Starts a DIDComm connection and prints the out-of-band invitation URL.",
    code: `const base = process.env.AGENT_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  ...(process.env.AGENT_API_KEY ? { apikey: process.env.AGENT_API_KEY } : {}),
};

const conn = await fetch(base + "/connections", {
  method: "POST",
  headers,
  body: JSON.stringify({ label: "sandbox-invite", goalCode: "connect" }),
}).then((r) => r.json());

console.log("connectionId:", conn.connectionId);
console.log("state:", conn.state);
console.log("invitation:", conn.invitation?.invitationUrl);
`,
  },
  {
    name: "Issue a credential offer",
    description: "Offers a JWT credential from an issuing DID over an existing connection.",
    code: `const base = process.env.AGENT_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  ...(process.env.AGENT_API_KEY ? { apikey: process.env.AGENT_API_KEY } : {}),
};

// Replace with ids from your agent.
const connectionId = "<connection-id>";
const issuingDID = "<did:prism:...>";

const offer = await fetch(base + "/issue-credentials/credential-offers", {
  method: "POST",
  headers,
  body: JSON.stringify({
    connectionId,
    issuingDID,
    credentialFormat: "JWT",
    automaticIssuance: true,
    claims: { name: "Alice", degree: "MSc Cryptography" },
  }),
}).then((r) => r.json());

console.log(JSON.stringify(offer, null, 2));
`,
  },
  {
    name: "List presentation records",
    description: "Reads present-proof records from the agent to inspect verification state.",
    code: `const base = process.env.AGENT_BASE_URL;
const headers = {
  ...(process.env.AGENT_API_KEY ? { apikey: process.env.AGENT_API_KEY } : {}),
};

const records = await fetch(base + "/present-proof/presentations", { headers }).then((r) =>
  r.json(),
);
console.log("presentations:", records.contents?.length ?? 0);
console.log(JSON.stringify(records, null, 2).slice(0, 2000));
`,
  },
];
