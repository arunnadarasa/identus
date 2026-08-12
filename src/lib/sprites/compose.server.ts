/**
 * Compose Lab bundle: the Identus docker-compose stack plus a validator that
 * runs inside the sprite. Server-only.
 *
 * Sprites have no Docker daemon, so nothing here starts containers — the lab
 * authors, interpolates and lints the stack, then hands you the commands to
 * run it on your own machine.
 */

import { SPRITE_DIR } from "./sprites.server";

export const LAB_DIR = `${SPRITE_DIR}/compose-lab`;

export const AGENT_IMAGE = "identus/identus-cloud-agent:1.40.0";
export const NODE_IMAGE = "identus/prism-node:2.5.0";
export const POSTGRES_IMAGE = "postgres:16-alpine";

export const COMPOSE_FILE = "docker-compose.yml";
export const ENV_FILE = ".env";
export const INIT_SQL_FILE = "postgres/init.sql";

export const DEFAULT_COMPOSE = `# Identus Cloud Agent — local stack
# Validated in the Compose Lab, run with:  docker compose up -d --wait
services:
  postgres:
    image: ${POSTGRES_IMAGE}
    restart: unless-stopped
    networks: [identus]
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_MULTIPLE_DATABASES: pollux,connect,agent,node
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "\${POSTGRES_PORT}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 20

  prism-node:
    image: ${NODE_IMAGE}
    restart: unless-stopped
    networks: [identus]
    environment:
      NODE_PSQL_HOST: postgres:5432
      NODE_PSQL_DATABASE: node
      NODE_PSQL_USERNAME: \${POSTGRES_USER}
      NODE_PSQL_PASSWORD: \${POSTGRES_PASSWORD}
      NODE_REFRESH_AND_SUBMIT_PERIOD: 5s
      NODE_MOVE_SCHEDULED_TO_PENDING_PERIOD: 5s
      NODE_WALLET_MAX_TPS: 10
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "\${PRISM_NODE_PORT}:50053"

  cloud-agent:
    image: ${AGENT_IMAGE}
    restart: unless-stopped
    networks: [identus]
    environment:
      POLLUX_DB_HOST: postgres
      POLLUX_DB_PORT: 5432
      POLLUX_DB_NAME: pollux
      POLLUX_DB_USER: \${POSTGRES_USER}
      POLLUX_DB_PASSWORD: \${POSTGRES_PASSWORD}
      CONNECT_DB_HOST: postgres
      CONNECT_DB_PORT: 5432
      CONNECT_DB_NAME: connect
      CONNECT_DB_USER: \${POSTGRES_USER}
      CONNECT_DB_PASSWORD: \${POSTGRES_PASSWORD}
      AGENT_DB_HOST: postgres
      AGENT_DB_PORT: 5432
      AGENT_DB_NAME: agent
      AGENT_DB_USER: \${POSTGRES_USER}
      AGENT_DB_PASSWORD: \${POSTGRES_PASSWORD}
      PRISM_NODE_HOST: prism-node
      PRISM_NODE_PORT: 50053
      DIDCOMM_SERVICE_URL: http://localhost:\${DIDCOMM_PORT}
      REST_SERVICE_URL: http://localhost:\${AGENT_PORT}
      ADMIN_TOKEN: \${ADMIN_TOKEN}
      API_KEY_ENABLED: "true"
      API_KEY_AUTHENTICATE_AS_DEFAULT_USER: "true"
      DEFAULT_WALLET_ENABLED: "true"
      DEFAULT_WALLET_AUTH_API_KEY: \${DEFAULT_WALLET_AUTH_API_KEY}
      SECRET_STORAGE_BACKEND: postgres
    depends_on:
      postgres:
        condition: service_healthy
      prism-node:
        condition: service_started
    ports:
      - "\${AGENT_PORT}:8085"
      - "\${DIDCOMM_PORT}:8090"
    healthcheck:
      # 'docker compose up --wait' blocks until this reports healthy.
      test: ["CMD-SHELL", "curl -fsS http://localhost:8085/_system/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 60s

networks:
  identus:
    driver: bridge

volumes:
  pgdata:

`;

export const DEFAULT_ENV = `# Ports exposed on your machine
AGENT_PORT=8085
DIDCOMM_PORT=8090
PRISM_NODE_PORT=50053
POSTGRES_PORT=5432

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Agent auth — the console uses ADMIN_TOKEN as the admin API key
ADMIN_TOKEN=local-admin-token
DEFAULT_WALLET_AUTH_API_KEY=local-admin-token
`;

export const DEFAULT_INIT_SQL = `-- Creates every database the Identus stack expects.
-- Separate databases avoid migration collisions between the agent modules.
CREATE DATABASE pollux;
CREATE DATABASE connect;
CREATE DATABASE agent;
CREATE DATABASE node;
`;

export const LAB_FILE_NAMES = [COMPOSE_FILE, ENV_FILE, INIT_SQL_FILE] as const;

export function defaultFor(name: string) {
  if (name === COMPOSE_FILE) return DEFAULT_COMPOSE;
  if (name === ENV_FILE) return DEFAULT_ENV;
  if (name === INIT_SQL_FILE) return DEFAULT_INIT_SQL;
  return "";
}

export function defaultBundle() {
  return LAB_FILE_NAMES.map((name) => ({ name, content: defaultFor(name) }));
}

/** Commands to run the validated stack on the user's own machine. */
export function runCommands() {
  return [
    "# unzip / copy the bundle, then from its folder:",
    "docker compose config          # sanity check",
    "docker compose up -d",
    "docker compose logs -f cloud-agent",
    "",
    "# agent REST API:  http://localhost:8085/cloud-agent",
    "# health:          curl http://localhost:8085/cloud-agent/_system/health",
  ].join("\n");
}

/**
 * Python validator. Prints a single JSON object so the server can render
 * structured errors/warnings plus the interpolated config.
 */
export const VALIDATOR = String.raw`
import json, os, re, sys

try:
    import yaml
except Exception as exc:  # pragma: no cover - reported to the UI
    print(json.dumps({"errors": ["PyYAML is not installed: %s" % exc], "warnings": [], "resolved": ""}))
    sys.exit(0)

errors, warnings = [], []

def read(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None

compose_raw = read("docker-compose.yml")
env_raw = read(".env") or ""
init_sql = read("postgres/init.sql")

env = {}
for line in env_raw.splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key.strip()] = value.strip()

missing = []

def substitute(text):
    pattern = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(:?-([^}]*))?\}")

    def repl(match):
        name, _, default = match.group(1), match.group(2), match.group(3)
        if name in env and env[name] != "":
            return env[name]
        if default is not None:
            return default
        missing.append(name)
        return ""

    return pattern.sub(repl, text)

resolved_text = ""
if compose_raw is None:
    errors.append("docker-compose.yml is missing.")
else:
    resolved_text = substitute(compose_raw)
    try:
        doc = yaml.safe_load(resolved_text) or {}
    except yaml.YAMLError as exc:
        doc = None
        errors.append("YAML parse error: %s" % str(exc).replace("\n", " "))

    if isinstance(doc, dict):
        services = doc.get("services") or {}
        if not services:
            errors.append("No services defined.")
        declared_volumes = set((doc.get("volumes") or {}).keys())
        host_ports = {}
        for name, svc in services.items():
            if not isinstance(svc, dict):
                errors.append("Service '%s' is not a mapping." % name)
                continue
            image = svc.get("image")
            if not image and not svc.get("build"):
                errors.append("Service '%s' has neither image nor build." % name)
            if isinstance(image, str):
                tag = image.rsplit(":", 1)[-1] if ":" in image.rsplit("/", 1)[-1] else ""
                if not tag:
                    warnings.append("Service '%s' image '%s' has no tag — pin a version." % (name, image))
                elif tag == "latest":
                    warnings.append("Service '%s' uses ':latest' — pin an explicit version." % name)
            for dep in (svc.get("depends_on") or {}):
                if dep not in services:
                    errors.append("Service '%s' depends on unknown service '%s'." % (name, dep))
            for mapping in (svc.get("ports") or []):
                text = str(mapping)
                parts = text.split(":")
                host = parts[0] if len(parts) > 1 else None
                if host and host.isdigit():
                    if host in host_ports:
                        errors.append("Host port %s is claimed by both '%s' and '%s'." % (host, host_ports[host], name))
                    else:
                        host_ports[host] = name
            for mount in (svc.get("volumes") or []):
                text = str(mount)
                source = text.split(":")[0]
                if source.startswith(".") or source.startswith("/"):
                    local = source.lstrip("./")
                    if local and not os.path.exists(local):
                        errors.append("Service '%s' mounts '%s' which does not exist in the bundle." % (name, source))
                elif source and source not in declared_volumes:
                    errors.append("Service '%s' uses named volume '%s' which is not declared." % (name, source))

        agent = services.get("cloud-agent")
        if isinstance(agent, dict):
            agent_env = agent.get("environment") or {}
            if isinstance(agent_env, dict):
                for required in ("ADMIN_TOKEN", "PRISM_NODE_HOST", "POLLUX_DB_NAME", "CONNECT_DB_NAME", "AGENT_DB_NAME"):
                    if required not in agent_env:
                        errors.append("cloud-agent is missing required env '%s'." % required)
                if str(agent_env.get("ADMIN_TOKEN", "")).strip() in ("", "local-admin-token"):
                    warnings.append("ADMIN_TOKEN is empty or still the default — change it before exposing the agent.")
        else:
            warnings.append("No 'cloud-agent' service found; the console expects one.")

for name in sorted(set(missing)):
    errors.append("Env var '%s' is referenced in the compose file but not set in .env." % name)

if init_sql is None:
    warnings.append("postgres/init.sql is missing — the agent databases will not be created.")
else:
    for db in ("pollux", "connect", "agent", "node"):
        if re.search(r"CREATE DATABASE\s+%s\b" % db, init_sql, re.IGNORECASE) is None:
            errors.append("postgres/init.sql does not create the '%s' database." % db)

print(json.dumps({"errors": errors, "warnings": warnings, "resolved": resolved_text[:60000]}))
`;

/** Installs python3 + PyYAML once. Prints the versions on the last lines. */
export const LAB_BOOTSTRAP = `
set -e
if ! command -v python3 >/dev/null 2>&1; then
  (apt-get update -y && apt-get install -y python3 python3-yaml) >/tmp/lab-setup.log 2>&1 || true
fi
command -v python3 >/dev/null 2>&1 || { tail -30 /tmp/lab-setup.log; echo "python3 unavailable"; exit 1; }
if ! python3 -c "import yaml" >/dev/null 2>&1; then
  (apt-get update -y && apt-get install -y python3-yaml) >>/tmp/lab-setup.log 2>&1 || true
fi
if ! python3 -c "import yaml" >/dev/null 2>&1; then
  (python3 -m pip install --break-system-packages pyyaml) >>/tmp/lab-setup.log 2>&1 || true
fi
python3 -c "import yaml; print('pyyaml ' + yaml.__version__)" || echo "pyyaml missing"
python3 --version
`;

export const RUN_VALIDATOR = `cd ${LAB_DIR} && python3 validate.py 2>&1`;
