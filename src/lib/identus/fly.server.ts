export const FLY_API = "https://api.machines.dev/v1";
export const FLY_GRAPHQL = "https://api.fly.io/graphql";

// The hyperledger-identus GHCR packages are not anonymously pullable, which Fly
// reports as `failed to get manifest ...: unauthorized`. The project publishes
// public images on Docker Hub instead — pin them so upstream releases can't
// silently break provisioning.
export const AGENT_IMAGE = "docker.io/identus/identus-cloud-agent:1.40.0";
export const PRISM_NODE_IMAGE = "docker.io/identus/prism-node:2.5.0";
export const POSTGRES_IMAGE = "postgres:16-alpine";

export interface Step {
  step: string;
  status: "ok" | "error" | "running";
  detail?: string | undefined;
  at: string;
  durationMs?: number | undefined;
  endpoint?: string | undefined;
  httpStatus?: number | undefined;
  raw?: string | undefined;
}

export function step(name: string, status: Step["status"], detail?: string): Step {
  return { step: name, status, detail, at: new Date().toISOString() };
}

/** Carries the full Fly response so the provisioning log can show the real cause. */
export class FlyApiError extends Error {
  readonly path: string;
  readonly status: number;
  readonly body: string;

  constructor(path: string, status: number, body: string) {
    super(`Fly API ${status} on ${path}: ${body.slice(0, 400)}`);
    this.name = "FlyApiError";
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

/** Turn opaque Fly registry failures into something actionable in the log. */
export function describeFlyError(error: FlyApiError) {
  const manifest = /failed to get manifest ([^\s"]+)/.exec(error.body);
  if (manifest) {
    return `Image ${manifest[1]} is not publicly pullable — Fly could not fetch its manifest`;
  }
  if (/unauthorized|denied/i.test(error.body) && error.status < 500) {
    return `Fly API ${error.status} — registry or token rejected the request`;
  }
  return `Fly API ${error.status}`;
}

function token() {
  const value = process.env["FLY_API_TOKEN"];
  if (!value) throw new Error("FLY_API_TOKEN is not configured for this project.");
  return value;
}

export async function fly(path: string, init: RequestInit = {}) {
  const res = await fetch(`${FLY_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new FlyApiError(path, res.status, text);
  }
  return text ? JSON.parse(text) : null;
}

export interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
}

export async function listMachines(appName: string): Promise<FlyMachine[]> {
  const raw = (await fly(`/apps/${appName}/machines`)) as
    | { id: string; name: string; state: string; region: string }[]
    | null;
  return (raw ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    state: m.state,
    region: m.region,
  }));
}


export async function flyGraphql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(FLY_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  const body = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length) {
    throw new Error(`Fly GraphQL error: ${body.errors?.[0]?.message ?? res.status}`);
  }
  return body.data;
}

export async function listOrganizations() {
  const data = (await flyGraphql(
    `query { organizations { nodes { id slug name } } }`,
    {},
  )) as { organizations: { nodes: { id: string; slug: string; name: string }[] } };
  return data.organizations.nodes;
}

export async function allocateSharedIpv4(appName: string) {
  await flyGraphql(
    `mutation($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { address type } } }`,
    { input: { appId: appName, type: "shared_v4" } },
  );
  await flyGraphql(
    `mutation($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { address type } } }`,
    { input: { appId: appName, type: "v6" } },
  );
}

export interface Guest {
  cpus: number;
  memoryMb: number;
}

export async function appExists(appName: string) {
  try {
    await fly(`/apps/${appName}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("404")) return false;
    throw error;
  }
}

export function suggestAppName() {
  return `identus-agent-${Math.random().toString(16).slice(2, 6)}`;
}

export function postgresMachineConfig(region: string, password: string) {
  return {
    name: "identus-postgres",
    region,
    config: {
      image: POSTGRES_IMAGE,
      env: {
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: password,
        POSTGRES_DB: "postgres",
        PGDATA: "/var/lib/postgresql/data/pgdata",
      },
      // The Cloud Agent keeps its components in separate databases; create all
      // three on first boot so schema migrations don't collide.
      files: [
        {
          guest_path: "/docker-entrypoint-initdb.d/00-identus-databases.sh",
          raw_value: Buffer.from(
            [
              "#!/bin/bash",
              "set -e",
              'for db in pollux connect agent; do',
              '  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \\',
              "    -c \"CREATE DATABASE $db\"",
              "done",
              "",
            ].join("\n"),
          ).toString("base64"),
        },
      ],
      mounts: [{ volume: "", path: "/var/lib/postgresql/data" }],
      guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
      services: [
        {
          ports: [{ port: 5432 }],
          protocol: "tcp",
          internal_port: 5432,
        },
      ],
    },
  };
}

export function prismNodeMachineConfig(region: string, pgHost: string, password: string) {
  return {
    name: "identus-prism-node",
    region,
    config: {
      image: PRISM_NODE_IMAGE,
      env: {
        NODE_PSQL_HOST: `${pgHost}:5432`,
        NODE_PSQL_DATABASE: "agent",
        NODE_PSQL_SCHEMA: "public",
        NODE_PSQL_USERNAME: "postgres",
        NODE_PSQL_PASSWORD: password,
        NODE_LEDGER: "in-memory",
        NODE_REFRESH_AND_SUBMIT_PERIOD: "7s",
        NODE_MOVE_SCHEDULED_TO_PENDING_PERIOD: "5s",
        NODE_WALLET_MAX_TPS: "10",
      },
      guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
      services: [{ ports: [{ port: 50053 }], protocol: "tcp", internal_port: 50053 }],
    },
  };
}

export function agentMachineConfig(
  region: string,
  pgHost: string,
  prismHost: string,
  password: string,
  adminKey: string,
  appName: string,
  guest: Guest = { cpus: 2, memoryMb: 2048 },
) {
  return {
    name: "identus-cloud-agent",
    region,
    config: {
      image: AGENT_IMAGE,
      env: {
        POSTGRES_HOST: pgHost,
        POSTGRES_PORT: "5432",
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: password,
        POLLUX_DB_NAME: "pollux",
        POLLUX_DB_HOST: pgHost,
        POLLUX_DB_PORT: "5432",
        POLLUX_DB_USER: "postgres",
        POLLUX_DB_PASSWORD: password,
        CONNECT_DB_NAME: "connect",
        CONNECT_DB_HOST: pgHost,
        CONNECT_DB_PORT: "5432",
        CONNECT_DB_USER: "postgres",
        CONNECT_DB_PASSWORD: password,
        AGENT_DB_NAME: "agent",
        AGENT_DB_HOST: pgHost,
        AGENT_DB_PORT: "5432",
        AGENT_DB_USER: "postgres",
        AGENT_DB_PASSWORD: password,
        PRISM_NODE_HOST: prismHost,
        PRISM_NODE_PORT: "50053",
        API_KEY_ENABLED: "true",
        API_KEY_AUTHENTICATE_AS_DEFAULT_USER: "true",
        DEFAULT_WALLET_ENABLED: "true",
        DEFAULT_WALLET_AUTH_API_KEY: adminKey,
        ADMIN_TOKEN: adminKey,
        AGENT_HTTP_PORT: "8085",
        AGENT_DIDCOMM_PORT: "8090",
        REST_SERVICE_URL: `https://${appName}.fly.dev/cloud-agent`,
        DIDCOMM_SERVICE_URL: `https://${appName}.fly.dev/didcomm`,
        SECRET_STORAGE_BACKEND: "postgres",
      },
      guest: { cpu_kind: "shared", cpus: guest.cpus, memory_mb: guest.memoryMb },
      services: [
        {
          ports: [
            { port: 80, handlers: ["http"] },
            { port: 443, handlers: ["http", "tls"] },
          ],
          protocol: "tcp",
          internal_port: 8085,
        },
      ],
      checks: {
        http: {
          type: "http",
          port: 8085,
          method: "GET",
          path: "/_system/health",
          interval: "15s",
          timeout: "5s",
          grace_period: "60s",
        },
      },
    },
  };
}

