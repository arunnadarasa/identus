export const FLY_API = "https://api.machines.dev/v1";
export const FLY_GRAPHQL = "https://api.fly.io/graphql";

export const AGENT_IMAGE = "ghcr.io/hyperledger-identus/cloud-agent:latest";
export const PRISM_NODE_IMAGE = "ghcr.io/hyperledger-identus/prism-node:latest";
export const POSTGRES_IMAGE = "postgres:16-alpine";

export interface Step {
  step: string;
  status: "ok" | "error" | "running";
  detail?: string;
  at: string;
}

export function step(name: string, status: Step["status"], detail?: string): Step {
  return { step: name, status, detail, at: new Date().toISOString() };
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
    throw new Error(`Fly API ${res.status} on ${path}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
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

export function postgresMachineConfig(region: string, password: string) {
  return {
    name: "identus-postgres",
    region,
    config: {
      image: POSTGRES_IMAGE,
      env: {
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: password,
        POSTGRES_DB: "agent",
        PGDATA: "/var/lib/postgresql/data/pgdata",
      },
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
        POLLUX_DB_NAME: "agent",
        CONNECT_DB_NAME: "agent",
        AGENT_DB_NAME: "agent",
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
      guest: { cpu_kind: "shared", cpus: 2, memory_mb: 2048 },
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
