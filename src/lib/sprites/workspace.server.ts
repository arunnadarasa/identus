/** Files and shell scripts that make up the SDK scratch workspace. Server-only. */
import { SPRITE_DIR } from "./sprites.server";
import { SDK_PACKAGES } from "./snippets";

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

/** Ensures a Node runtime exists; prints the version on the last line. */
export const NODE_BOOTSTRAP = `
set -e
if ! command -v node >/dev/null 2>&1; then
  (curl -fsSL https://deb.nodesource.com/setup_20.x | bash -) >/tmp/node-setup.log 2>&1 || true
  (apt-get install -y nodejs) >>/tmp/node-setup.log 2>&1 || true
fi
command -v node >/dev/null 2>&1 || { tail -40 /tmp/node-setup.log; echo "node unavailable"; exit 1; }
node -v
`;

function installScript(clean: boolean) {
  const candidates = SDK_PACKAGES.map(
    (pkg) => `if [ -z "$FOUND" ]; then
  if npm install --no-audit --no-fund ${pkg} >>/tmp/npm-install.log 2>&1; then FOUND=${pkg}; fi
fi`,
  ).join("\n");

  return `
set -e
cd ${SPRITE_DIR}
${clean ? "rm -rf node_modules package-lock.json" : ""}
: >/tmp/npm-install.log
FOUND=""
${candidates}
tail -40 /tmp/npm-install.log
if [ -z "$FOUND" ]; then
  echo "Could not install the Identus SDK from npm. Snippets using plain fetch still work."
else
  echo "SDK_PACKAGE=$FOUND"
fi
`;
}

export const INSTALL_SDK = installScript(false);
export const INSTALL_SDK_CLEAN = installScript(true);

/** Runs the snippet the caller just wrote, merging stderr into stdout. */
export const RUN_SNIPPET = `cd ${SPRITE_DIR} && node snippets/run.mjs 2>&1`;
