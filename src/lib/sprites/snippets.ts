/** Starter snippets seeded into a new scratch box. Client-safe (no server imports). */
export interface StarterSnippet {
  name: string;
  description: string;
  /**
   * Bumped whenever the template body changes. Saved snippets store the version
   * they were seeded from, so the Sandbox can point out stale copies instead of
   * letting an old snippet fail with a confusing runtime error.
   */
  version: string;
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
    version: "3",
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

// The resolved document does NOT expose a top-level \`verificationMethod\` array.
// Depending on the SDK build the methods live under \`verificationMethods\`, or
// inside \`coreProperties\` entries that each carry a \`values\` array. Collect
// from whichever shape is present instead of indexing into undefined.
function collectMethods(doc) {
  const out = [];
  const push = (value) => {
    if (!value) return;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item && typeof item === "object" && (item.id || item.type)) out.push(item);
    }
  };
  push(doc?.verificationMethods?.values ?? doc?.verificationMethods);
  push(doc?.verificationMethod);
  for (const prop of doc?.coreProperties ?? []) {
    push(prop?.values);
    push(prop?.verificationMethods);
  }
  return out;
}

const methods = collectMethods(resolved);
const byType = (needle) =>
  methods.filter((m) => String(m.type ?? "").toLowerCase().includes(needle)).length;

console.log("verification methods:", methods.length);
console.log("authentication-ish:", byType("ed25519") || byType("authentication"));
console.log("key agreement-ish:", byType("x25519") || byType("agreement"));
console.log("first method id:", methods[0]?.id ?? "(none)");

// Always print the document so the real shape is visible if the counts look odd.
console.log(JSON.stringify(resolved, null, 2).slice(0, 1500));
`,
  },
  {
    name: "Agent health & version",
    description: "Raw fetch against the active agent to confirm connectivity.",
    version: "1",
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
    version: "2",
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
    version: "1",
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
    description: "Finds an established connection and a published issuer DID, then offers a JWT credential.",
    version: "2",
    code: `const base = process.env.AGENT_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  ...(process.env.AGENT_API_KEY ? { apikey: process.env.AGENT_API_KEY } : {}),
};

// 1. Find an established connection (no placeholders — read it from the agent).
const conns = await fetch(base + "/connections", { headers }).then((r) => r.json());
const connection = (conns.contents ?? []).find((c) =>
  ["ConnectionResponseSent", "ConnectionResponseReceived"].includes(c.state),
);
if (!connection) {
  console.log(
    "No established connection yet. Run the 'Create a connection invitation' snippet and accept it from the other side (or use the console's Connections page), then run this again.",
  );
  process.exit(0);
}
const connectionId = connection.connectionId;

// 2. Find a published issuer DID that can sign credentials.
const dids = await fetch(base + "/did-registrar/dids", { headers }).then((r) => r.json());
const issuer = (dids.contents ?? []).find(
  (d) => d.status === "PUBLISHED" && d.did?.startsWith("did:prism:"),
);
if (!issuer) {
  console.log(
    "No published issuer DID yet. Publish one with the 'Publish a PRISM DID' snippet or from the console's DIDs page, then run this again.",
  );
  process.exit(0);
}
const issuingDID = issuer.did;

console.log("connectionId:", connectionId);
console.log("issuingDID:", issuingDID);

const offer = await fetch(base + "/issue-credentials/credential-offers", {
  method: "POST",
  headers,
  body: JSON.stringify({
    connectionId,
    issuingDID,
    credentialFormat: "JWT",
    automaticIssuance: true,
    claims: { name: "Alice", degree: "MSc Cryptography", dob: "2003-05-12" },
  }),
}).then((r) => r.json());

console.log(JSON.stringify(offer, null, 2));
`,
  },
  {
    name: "List presentation records",
    description: "Reads present-proof records from the agent to inspect verification state.",
    version: "1",
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

/** Name → current template version, for stale-copy detection. */
export const STARTER_VERSIONS: Record<string, string> = Object.fromEntries(
  STARTER_SNIPPETS.map((s) => [s.name, s.version]),
);
