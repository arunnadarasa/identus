/** Files and shell scripts that make up the SDK scratch workspace. Server-only. */
import { SPRITE_DIR } from "./sprites.server";

const STATUS_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Identus SDK sandbox</title></head>
  <body style="font-family:system-ui;background:#0b0d10;color:#e6e8eb;padding:2rem">
    <h1>Identus SDK sandbox</h1>
    <p>This box keeps a Node workspace with the Identus TypeScript SDK installed.</p>
    <p>Snippets run from <code>${SPRITE_DIR}/snippets/run.mjs</code>.</p>
  </body>
</html>
`;

const PACKAGE_JSON = JSON.stringify(
  {
    name: "identus-sdk-sandbox",
    private: true,
    type: "module",
    version: "1.0.0",
    description: "Scratch workspace for Identus SDK snippets",
  },
  null,
  2,
);

export function workspaceFiles() {
  return [
    { path: `${SPRITE_DIR}/index.html`, content: STATUS_PAGE },
    { path: `${SPRITE_DIR}/package.json`, content: `${PACKAGE_JSON}\n` },
    {
      path: `${SPRITE_DIR}/snippets/run.mjs`,
      content: 'console.log("sandbox ready");\n',
    },
  ];
}

/** Ensures npm is available. Snippets use the workspace-pinned Node 20 binary below. */
export const NODE_BOOTSTRAP = `
set -e
if ! command -v node >/dev/null 2>&1; then
  (curl -fsSL https://deb.nodesource.com/setup_20.x | bash -) >/tmp/node-setup.log 2>&1 || true
  (apt-get install -y nodejs) >>/tmp/node-setup.log 2>&1 || true
fi
command -v node >/dev/null 2>&1 || { tail -40 /tmp/node-setup.log; echo "node unavailable"; exit 1; }
node -v
`;

/** Pinned SDK release. Floating "latest" resolved to a stale 5.x tree that requires rxdb. */
export const SDK_PACKAGE = "@hyperledger/identus-edge-agent-sdk";
export const SDK_VERSION = "6.6.0";
/** Runtime peer dependencies the SDK expects the host project to provide. */
const SDK_RUNTIME = [
  "node@20",
  "rxdb@14.17.1",
  "rxjs@^7.8.1",
  "elliptic@^6.5.4",
  "buffer@^6.0.3",
  "core-js@^3.32.2",
];

function installScript(clean: boolean) {
  return `
set -e
cd ${SPRITE_DIR}
: >/tmp/npm-install.log
INSTALLED=""
if [ -f node_modules/${SDK_PACKAGE}/package.json ]; then
  INSTALLED=$(node -e "process.stdout.write(require('./node_modules/${SDK_PACKAGE}/package.json').version)" 2>/dev/null || echo "")
fi
echo "installed_before=\${INSTALLED:-none}" >>/tmp/npm-install.log
if [ "${clean ? "1" : "0"}" = "1" ] || { [ -n "$INSTALLED" ] && [ "$INSTALLED" != "${SDK_VERSION}" ]; }; then
  echo "clearing stale tree (\${INSTALLED:-none})" >>/tmp/npm-install.log
  rm -rf node_modules package-lock.json
fi
FOUND=""
if npm install --ignore-scripts --no-audit --no-fund ${SDK_PACKAGE}@${SDK_VERSION} ${SDK_RUNTIME.join(" ")} >>/tmp/npm-install.log 2>&1; then
  FOUND=${SDK_PACKAGE}@${SDK_VERSION}
fi
tail -200 /tmp/npm-install.log
if [ -z "$FOUND" ]; then
  echo "Could not install the Identus SDK from npm. Snippets using plain fetch still work."
else
  echo "SDK_PACKAGE=$FOUND"
fi
`;
}

export const INSTALL_SDK = installScript(false);
export const INSTALL_SDK_CLEAN = installScript(true);

/**
 * Imports the SDK for real and prints SDK_VERSION=<version>. A broken tree fails here
 * with the actual module error instead of surfacing later inside a user snippet.
 */
export const VERIFY_SDK = `
set -e
cd ${SPRITE_DIR}
cat > sdk-probe.mjs <<'PROBE'
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync("node_modules/${SDK_PACKAGE}/package.json", "utf8"));
const rxdbPkg = JSON.parse(readFileSync(require.resolve("rxdb/package.json"), "utf8"));
const mod = await import("${SDK_PACKAGE}");
const SDK = mod.default ?? mod;
const missing = ["Apollo", "Castor", "Domain"].filter((k) => !SDK?.[k]);
if (missing.length) throw new Error("SDK is missing exports: " + missing.join(", "));
console.log("NODE_VERSION=" + process.version);
console.log("RXDB_VERSION=" + rxdbPkg.version);
console.log("SDK_VERSION=" + pkg.version);
PROBE
./node_modules/.bin/node sdk-probe.mjs 2>&1
`;

/** Runs the snippet the caller just wrote, merging stderr into stdout. */
export const RUN_SNIPPET = `cd ${SPRITE_DIR} && ./node_modules/.bin/node snippets/run.mjs 2>&1`;

