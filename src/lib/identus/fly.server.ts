export const FLY_API = "https://api.machines.dev/v1";
export const FLY_GRAPHQL = "https://api.fly.io/graphql";

// The hyperledger-identus GHCR packages are not anonymously pullable, which Fly
// reports as `failed to get manifest ...: unauthorized`. The project publishes
// public images on Docker Hub instead — pin them so upstream releases can't
// silently break provisioning.
export const AGENT_IMAGE = "docker.io/identus/identus-cloud-agent:1.40.0";
export const PRISM_NODE_IMAGE = "docker.io/identus/prism-node:2.5.0";
// Identus 1.40's Flyway migrations are written against the Postgres upstream's
// compose stack ships. On Postgres 16 the SQL/JSON `FORMAT JSON` clause makes
// V27's bare `format json` column a syntax error (SQLSTATE 42601), so the agent
// dies mid-migration and never binds its port. Pin 13 until Identus supports newer.
export const POSTGRES_VERSION = "13";
export const POSTGRES_IMAGE = `postgres:${POSTGRES_VERSION}-alpine`;

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

export interface FlyAppSummary {
  name: string;
  status: string;
  machineCount: number;
  machines: FlyMachine[];
  machinesMessage?: string | undefined;
}

/** Apps in an organisation, each with its live machine states. */
export async function listApps(orgSlug: string): Promise<FlyAppSummary[]> {
  const raw = (await fly(`/apps?org_slug=${encodeURIComponent(orgSlug)}`)) as {
    apps?: { name: string; status?: string; machine_count?: number }[];
  } | null;
  const apps = raw?.apps ?? [];
  return Promise.all(
    apps.map(async (app) => {
      let machines: FlyMachine[] = [];
      let machinesMessage: string | undefined;
      try {
        machines = await listMachines(app.name);
      } catch (error) {
        machinesMessage = error instanceof Error ? error.message : String(error);
      }
      return {
        name: app.name,
        status: app.status ?? "unknown",
        machineCount: app.machine_count ?? machines.length,
        machines,
        machinesMessage,
      };
    }),
  );
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

export interface FlyIpAddress {
  address: string;
  type: string;
}

/** Public IPs currently attached to the app. Empty means `<app>.fly.dev` has no DNS. */
export async function listIpAddresses(appName: string): Promise<FlyIpAddress[]> {
  const data = (await flyGraphql(
    `query($name: String!) { app(name: $name) { ipAddresses { nodes { address type } } } }`,
    { name: appName },
  )) as { app?: { ipAddresses?: { nodes?: FlyIpAddress[] } } } | null;
  return (data?.app?.ipAddresses?.nodes ?? []).map((n) => ({
    address: String(n.address),
    type: String(n.type),
  }));
}

/**
 * Attaches a shared IPv4 and a dedicated IPv6 to the app.
 *
 * Fly only publishes `<app>.fly.dev` DNS once an IP exists, so this verifies the
 * result instead of trusting the mutation: a silently no-op allocation leaves an
 * app whose hostname never resolves, which looks exactly like an agent that
 * booted but never answers.
 */
export async function allocateSharedIpv4(appName: string): Promise<FlyIpAddress[]> {
  const allocate = async (type: "shared_v4" | "v6") => {
    try {
      await flyGraphql(
        `mutation($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { address type } } }`,
        { input: { appId: appName, type } },
      );
    } catch (error) {
      // "already allocated" is success from our point of view.
      const message = error instanceof Error ? error.message : String(error);
      if (!/already|exists|taken/i.test(message)) throw error;
    }
  };
  await allocate("shared_v4");
  await allocate("v6");

  const ips = await listIpAddresses(appName);
  if (!ips.length) {
    throw new Error(
      `Fly accepted the allocation but ${appName} still has no public IP, so ${appName}.fly.dev will not resolve. This usually means the API token is scoped to a deploy-only role that cannot allocate IPs — use an organisation token.`,
    );
  }
  return ips;
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

/** Roles the Cloud Agent's migrations GRANT to after creating each schema. */
export const APP_ROLES = [
  { role: "pollux-application-user", db: "pollux" },
  { role: "connect-application-user", db: "connect" },
  { role: "agent-application-user", db: "agent" },
] as const;

export function postgresMachineConfig(region: string, password: string, appPassword: string) {
  return {
    name: "identus-postgres",
    region,
    // The process group is what `<group>.process.<app>.internal` resolves to;
    // machine names are not part of Fly's private DNS.
    metadata: { fly_process_group: "postgres" },
    config: {
      image: POSTGRES_IMAGE,
      env: {
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: password,
        POSTGRES_DB: "postgres",
        PGDATA: "/var/lib/postgresql/data/pgdata",
      },
      // The Cloud Agent keeps its components in separate databases; create all
      // four on first boot so schema migrations don't collide. Each component
      // also migrates as `postgres` and then GRANTs to a dedicated
      // `<component>-application-user` role, so those roles must exist first or
      // the very first migration aborts with `role ... does not exist`.
      files: [
        {
          guest_path: "/docker-entrypoint-initdb.d/00-identus-databases.sh",
          raw_value: Buffer.from(
            [
              "#!/bin/bash",
              "set -e",
              `APP_PASSWORD='${appPassword}'`,
              "for db in pollux connect agent node; do",
              '  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \\',
              '    -c "CREATE DATABASE $db"',
              "done",
              ...APP_ROLES.flatMap(({ role, db }) => [
                `psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \\`,
                `  -c "CREATE ROLE \\"${role}\\" WITH LOGIN PASSWORD '$APP_PASSWORD'" \\`,
                `  -c "GRANT CONNECT ON DATABASE ${db} TO \\"${role}\\""`,
                `psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname ${db} \\`,
                `  -c "GRANT USAGE, CREATE ON SCHEMA public TO \\"${role}\\""`,
              ]),
              "",
            ].join("\n"),
          ).toString("base64"),
        },
      ],
      mounts: [{ volume: "", path: "/var/lib/postgresql/data" }],
      guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
      // No `services` block: Postgres is reached over the app's private 6PN
      // network only and must never be published to the internet.
    },
  };
}


export function prismNodeMachineConfig(region: string, pgHost: string, password: string) {
  return {
    name: "identus-prism-node",
    region,
    metadata: { fly_process_group: "prism-node" },
    config: {
      image: PRISM_NODE_IMAGE,
      env: {
        NODE_PSQL_HOST: `${pgHost}:5432`,
        NODE_PSQL_DATABASE: "node",
        NODE_PSQL_SCHEMA: "public",
        NODE_PSQL_USERNAME: "postgres",
        NODE_PSQL_PASSWORD: password,
        NODE_LEDGER: "in-memory",
        NODE_REFRESH_AND_SUBMIT_PERIOD: "7s",
        NODE_MOVE_SCHEDULED_TO_PENDING_PERIOD: "5s",
        NODE_WALLET_MAX_TPS: "10",
        // Fly's private network is IPv6-only. The JVM prefers IPv4 by default,
        // so JDBC never dials the Postgres 6PN address without this flag.
        JAVA_TOOL_OPTIONS:
          "-Djava.net.preferIPv6Addresses=true -Djava.net.preferIPv4Stack=false -XX:MaxRAMPercentage=70",
      },
      guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
      // gRPC is consumed by the agent over 6PN only.
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
  guest: Guest = { cpus: 4, memoryMb: 4096 },
  appPassword: string = password,
) {
  return {
    name: "identus-cloud-agent",
    region,
    metadata: { fly_process_group: "agent" },
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
        // Migrations run as `postgres` and then GRANT to these roles, which the
        // Postgres init script creates on first boot.
        POLLUX_DB_APP_USER: "pollux-application-user",
        POLLUX_DB_APP_PASSWORD: appPassword,
        CONNECT_DB_NAME: "connect",
        CONNECT_DB_HOST: pgHost,
        CONNECT_DB_PORT: "5432",
        CONNECT_DB_USER: "postgres",
        CONNECT_DB_PASSWORD: password,
        CONNECT_DB_APP_USER: "connect-application-user",
        CONNECT_DB_APP_PASSWORD: appPassword,
        AGENT_DB_NAME: "agent",
        AGENT_DB_HOST: pgHost,
        AGENT_DB_PORT: "5432",
        AGENT_DB_USER: "postgres",
        AGENT_DB_PASSWORD: password,
        AGENT_DB_APP_USER: "agent-application-user",
        AGENT_DB_APP_PASSWORD: appPassword,

        PRISM_NODE_HOST: prismHost,
        PRISM_NODE_PORT: "50053",
        API_KEY_ENABLED: "true",
        API_KEY_AUTHENTICATE_AS_DEFAULT_USER: "true",
        DEFAULT_WALLET_ENABLED: "true",
        DEFAULT_WALLET_AUTH_API_KEY: adminKey,
        ADMIN_TOKEN: adminKey,
        AGENT_HTTP_PORT: "8085",
        AGENT_DIDCOMM_PORT: "8090",
        REST_SERVICE_URL: `https://${appName}.fly.dev`,
        DIDCOMM_SERVICE_URL: `https://${appName}.fly.dev/didcomm`,
        SECRET_STORAGE_BACKEND: "postgres",
        // Fly's private network is IPv6-only, so the JVM must be told not to
        // prefer IPv4 or JDBC/gRPC never reach Postgres and the PRISM node.
        // MaxRAMPercentage keeps the heap inside the machine's memory so the
        // first-boot schema migrations don't get OOM-killed.
        JAVA_TOOL_OPTIONS:
          "-Djava.net.preferIPv6Addresses=true -Djava.net.preferIPv4Stack=false -XX:MaxRAMPercentage=70",
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
          // First boot migrates four databases; a short grace period makes Fly
          // restart the agent mid-migration, which never converges.
          grace_period: "300s",
        },
      },

    },
  };
}

export interface MachineDiagnostic {
  id: string;
  name: string;
  state: string;
  region: string;
  image: string;
  privateIp: string | null;
  memoryMb: number | null;
  cpus: number | null;
  restarts: number;
  /** Fly health-check results; `output` usually carries the real error text. */
  checks: { name: string; status: string; output: string }[];
  /** Newest first. Non-zero `exitCode` or `oomKilled` is the smoking gun. */
  events: {
    type: string;
    status: string;
    at: string;
    exitCode: number | null;
    oomKilled: boolean;
    signal: number | null;
  }[];
  /** Plain-language reading of the above. */
  diagnosis: string;
  fatal: boolean;
}

function readEvents(raw: any) {
  return ((raw?.events ?? []) as any[]).map((e) => {
    const exit = e?.request?.exit_event ?? e?.request?.MonitorEvent?.exit_event ?? null;
    return {
      type: String(e?.type ?? "event"),
      status: String(e?.status ?? ""),
      at: e?.timestamp ? new Date(Number(e.timestamp)).toISOString() : "",
      exitCode: typeof exit?.exit_code === "number" ? exit.exit_code : null,
      oomKilled: Boolean(exit?.oom_killed),
      signal: typeof exit?.signal === "number" ? exit.signal : null,
    };
  });
}

function diagnose(raw: any, events: MachineDiagnostic["events"], checks: MachineDiagnostic["checks"]) {
  const oom = events.find((e) => e.oomKilled);
  if (oom) {
    return {
      fatal: true,
      diagnosis:
        "The container was killed for running out of memory. Repair the machine with 4 GB or more for the Cloud Agent.",
    };
  }
  const exits = events.filter((e) => e.exitCode !== null && e.exitCode !== 0);
  const state = String(raw?.state ?? "unknown");
  const isAgent = String(raw?.name ?? "").includes("cloud-agent");

  // A stopped agent machine is the whole failure: Fly's edge accepts the TLS
  // handshake and then has nothing to forward to, so every probe just hangs.
  if (isAgent && state !== "started") {
    const last = exits[0] ?? events.find((e) => e.exitCode !== null);
    return {
      fatal: true,
      diagnosis: `The Cloud Agent machine is "${state}", so nothing is listening on port 8085 and every request to the public URL hangs.${
        last?.exitCode !== undefined && last?.exitCode !== null
          ? ` It last exited with code ${last.exitCode}.`
          : ""
      } The usual cause is too little memory for the first-boot database migrations — repair the machine with 4 GB and start it again.`,
    };
  }
  if (exits.length >= 3) {
    return {
      fatal: true,
      diagnosis: `The process is crash-looping (${exits.length} non-zero exits, last code ${exits[0]?.exitCode}). It cannot start with the current configuration.`,
    };
  }
  if (exits.length > 0) {
    return {
      fatal: false,
      diagnosis: `The process exited with code ${exits[0]?.exitCode} at least once and was restarted.`,
    };
  }
  const failing = checks.find((c) => c.status && c.status !== "passing");
  if (failing) {
    return {
      fatal: false,
      diagnosis: `Fly health check "${failing.name}" is ${failing.status}${
        failing.output ? `: ${failing.output.slice(0, 300)}` : ""
      }`,
    };
  }
  if (state === "started" && checks.length && checks.every((c) => c.status === "passing")) {
    return { fatal: false, diagnosis: "Machine is up and all Fly health checks pass." };
  }
  return {
    fatal: state !== "started" && state !== "starting" && state !== "created",
    diagnosis:
      state === "started"
        ? "Machine is up. The service is still starting — the Cloud Agent migrates four databases on first boot, which can take several minutes."
        : `Machine state is "${state}".`,
  };
}

/** Machine state, Fly check output and event history for one machine. */
export async function getMachineDiagnostics(
  appName: string,
  machineId: string,
): Promise<MachineDiagnostic> {
  const raw = (await fly(`/apps/${appName}/machines/${machineId}`)) as any;
  const checks = ((raw?.checks ?? []) as any[]).map((c) => ({
    name: String(c?.name ?? "check"),
    status: String(c?.status ?? ""),
    output: String(c?.output ?? ""),
  }));
  const events = readEvents(raw);
  const { diagnosis, fatal } = diagnose(raw, events, checks);
  const guest = raw?.config?.guest ?? {};
  return {
    id: String(raw?.id ?? machineId),
    name: String(raw?.name ?? machineId),
    state: String(raw?.state ?? "unknown"),
    region: String(raw?.region ?? ""),
    image: String(raw?.config?.image ?? ""),
    privateIp: raw?.private_ip ? String(raw.private_ip) : null,
    memoryMb: typeof guest?.memory_mb === "number" ? guest.memory_mb : null,
    cpus: typeof guest?.cpus === "number" ? guest.cpus : null,
    restarts: events.filter((e) => e.type === "restart" || e.status === "starting").length,
    checks,
    events: events.slice(0, 12),
    diagnosis,
    fatal,
  };
}

/** Diagnostics for every machine in the app, agent first. */
export async function getAppDiagnostics(appName: string): Promise<MachineDiagnostic[]> {
  const machines = await listMachines(appName);
  const details = await Promise.all(
    machines.map(async (m) => {
      try {
        return await getMachineDiagnostics(appName, m.id);
      } catch (error) {
        return {
          id: m.id,
          name: m.name,
          state: m.state,
          region: m.region,
          image: "",
          privateIp: null,
          memoryMb: null,
          cpus: null,
          restarts: 0,
          checks: [],
          events: [],
          diagnosis: error instanceof Error ? error.message : String(error),
          fatal: false,
        } satisfies MachineDiagnostic;
      }
    }),
  );
  const rank = (name: string) =>
    name.includes("cloud-agent") ? 0 : name.includes("prism") ? 1 : 2;
  // Anything not running is the reason you opened this panel, so it goes first.
  const broken = (m: MachineDiagnostic) => (m.fatal || m.state !== "started" ? 0 : 1);
  return details.sort(
    (a, b) => broken(a) - broken(b) || rank(a.name) - rank(b.name),
  );
}

/** The Cloud Agent machine, or null when the app has none. */
export async function findAgentMachine(appName: string) {
  const machines = await listMachines(appName);
  return machines.find((m) => m.name.includes("cloud-agent")) ?? null;
}

/**
 * Repairs an agent machine that exited during first boot: applies a bigger guest
 * (the four first-boot migrations OOM at 2 GB) and starts it again.
 *
 * Fly replaces the whole machine config on update, so the current config is read
 * first and only `guest` is patched.
 */
export async function resizeAndStartAgentMachine(
  appName: string,
  machineId: string,
  guest: Guest = { cpus: 4, memoryMb: 4096 },
) {
  const machine = await getMachine(appName, machineId);
  const previous = (machine.config["guest"] ?? {}) as { cpus?: number; memory_mb?: number };
  const resized =
    previous.memory_mb !== guest.memoryMb || previous.cpus !== guest.cpus;

  if (resized) {
    await fly(`/apps/${appName}/machines/${machineId}`, {
      method: "POST",
      body: JSON.stringify({
        config: {
          ...machine.config,
          guest: { cpu_kind: "shared", cpus: guest.cpus, memory_mb: guest.memoryMb },
        },
      }),
    });
  }

  // A machine that is already started stays started; only a stopped/failed one
  // needs the explicit start.
  if (machine.state !== "started") {
    await fly(`/apps/${appName}/machines/${machineId}/start`, { method: "POST" });
  }
  await waitForMachineState(appName, machineId, "started", 120);

  return {
    resized,
    previousMemoryMb: previous.memory_mb ?? null,
    previousCpus: previous.cpus ?? null,
    memoryMb: guest.memoryMb,
    cpus: guest.cpus,
  };
}


export interface FlyMachineDetail {
  id: string;
  name: string;
  state: string;
  region: string;
  config: Record<string, any>;
}

export async function getMachine(appName: string, machineId: string): Promise<FlyMachineDetail> {
  const raw = (await fly(`/apps/${appName}/machines/${machineId}`)) as any;
  return {
    id: raw.id,
    name: raw.name,
    state: raw.state,
    region: raw.region,
    config: (raw.config ?? {}) as Record<string, any>,
  };
}

/**
 * Rewrites a machine with a merged env block. Fly replaces the whole config on
 * update, so the current config is read first and only `env` is patched.
 */
export async function updateMachineEnv(
  appName: string,
  machineId: string,
  env: Record<string, string>,
) {
  const machine = await getMachine(appName, machineId);
  const config = {
    ...machine.config,
    env: { ...(machine.config["env"] ?? {}), ...env },
  };
  const updated = (await fly(`/apps/${appName}/machines/${machineId}`, {
    method: "POST",
    body: JSON.stringify({ config }),
  })) as any;
  return { previousEnv: (machine.config["env"] ?? {}) as Record<string, string>, machine: updated };
}

/**
 * Blocks until the machine reaches `state`.
 *
 * Fly's wait endpoint only accepts a long-poll between 1s and 60s (and our own
 * fetch aborts at 30s), so a single long wait is impossible. Poll in short
 * bounded slices until the overall deadline passes; a wait timeout from Fly
 * (408) just means "not ready yet".
 */
export async function waitForMachineState(
  appName: string,
  machineId: string,
  state: "started" | "stopped" = "started",
  overallTimeoutSeconds = 180,
  onAttempt?: (attempt: number, elapsedSeconds: number) => void,
) {
  const slice = 20; // seconds per poll: inside Fly's [1s, 60s] and our 30s fetch abort
  const deadline = Date.now() + Math.max(slice, overallTimeoutSeconds) * 1000;
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    attempt += 1;
    onAttempt?.(attempt, Math.round((Date.now() - startedAt) / 1000));
    try {
      return await fly(
        `/apps/${appName}/machines/${machineId}/wait?state=${state}&timeout=${slice}`,
      );
    } catch (error) {
      lastError = error;
      const isTimeout =
        (error instanceof FlyApiError && (error.status === 408 || /timeout/i.test(error.body))) ||
        (error instanceof Error && error.name === "TimeoutError");
      if (!isTimeout) throw error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Machine ${machineId} did not reach state "${state}" in time`);
}


// ---------------------------------------------------------------------------
// Container logs
// ---------------------------------------------------------------------------

export interface FlyLogLine {
  at: string;
  level: string;
  instance: string;
  region: string;
  message: string;
}

export interface FlyLogReport {
  appName: string;
  machineId: string | null;
  /** Which machine the tail belongs to, so agent output is never confused with the PRISM node's. */
  machineName: string | null;
  machineState: string | null;
  /** False when the Cloud Agent machine printed nothing at all — itself a finding. */
  producedOutput: boolean;
  lines: FlyLogLine[];
  /** Plain-language reading of the log tail. */
  diagnosis: string;
  /** True when the logs name a failure that will not fix itself. */
  fatal: boolean;
}

/**
 * Fly's Machines API does not expose logs, so this reads the app log stream on
 * api.fly.io. Oldest first, so the newest lines land at the bottom of the tail.
 */
export async function fetchAppLogs(
  appName: string,
  machineId?: string | null,
): Promise<FlyLogLine[]> {
  const params = new URLSearchParams();
  if (machineId) params.set("instance", machineId);
  const url = `https://api.fly.io/api/v1/apps/${encodeURIComponent(appName)}/logs${
    params.size ? `?${params.toString()}` : ""
  }`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new FlyApiError(`/apps/${appName}/logs`, res.status, text);
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Fly returned a log payload that is not JSON: ${text.slice(0, 200)}`);
  }
  const rows = (parsed?.data ?? []) as any[];
  return rows.map((row) => {
    const a = row?.attributes ?? {};
    return {
      at: String(a.timestamp ?? ""),
      level: String(a.level ?? "info"),
      instance: String(a.instance ?? ""),
      region: String(a.region ?? ""),
      message: String(a.message ?? ""),
    } satisfies FlyLogLine;
  });
}

const LOG_RULES: { test: RegExp; fatal: boolean; diagnosis: string }[] = [
  {
    test: /OutOfMemoryError|Killed process|oom-kill|Out of memory/i,
    fatal: true,
    diagnosis:
      "The agent ran out of memory. Redeploy with at least 4 GB for the Cloud Agent machine.",
  },
  {
    test: /role "(pollux|connect|agent)-application-user" does not exist/i,
    fatal: true,
    diagnosis:
      "Postgres is missing the Identus application roles (pollux-application-user, connect-application-user, agent-application-user). The agent's first-boot migration GRANTs to them and aborts. The init script only runs on an empty volume — deploy a fresh app.",
  },
  {
    test: /syntax error at or near "format"|V27__presentation_definition_table\.sql failed/i,
    fatal: true,
    diagnosis:
      "Postgres is too new for this Cloud Agent version — its V27 migration uses a bare `format json` column, which Postgres 16+ rejects as a syntax error. Redeploy a fresh app so it gets Postgres 13; the volume cannot be downgraded in place.",
  },
  {

    test: /database "(pollux|connect|agent|node)" does not exist/i,
    fatal: true,
    diagnosis:
      "Postgres is missing one of the four Identus databases (pollux, connect, agent, node). The Postgres init script did not run — destroy the app and redeploy so the volume is created fresh.",
  },
  {
    test: /password authentication failed|FATAL:\s+role .* does not exist/i,
    fatal: true,
    diagnosis:
      "Postgres rejected the agent's credentials. The stored Postgres password and the database no longer match; redeploy with a fresh volume.",
  },
  {
    test: /UnknownHostException|Name or service not known|Temporary failure in name resolution/i,
    fatal: true,
    diagnosis:
      "The agent cannot resolve its Postgres or PRISM node hostname on Fly's private network. Internal DNS only resolves process-group names, so the machines' fly_process_group metadata must match the hostnames in the agent env.",
  },
  {
    test: /Connection refused|ConnectException|connect timed out|Connection to .* refused/i,
    fatal: false,
    diagnosis:
      "The agent resolved Postgres or the PRISM node but could not open a connection — the dependency is probably still booting, or the JVM is still preferring IPv4 on Fly's IPv6-only private network.",
  },
  {
    test: /Address already in use|Failed to bind/i,
    fatal: true,
    diagnosis:
      "The REST service could not bind its port. Two processes are competing for 8085 inside the machine.",
  },
  {
    test: /Flyway|Migrating schema|migration|Successfully applied/i,
    fatal: false,
    diagnosis:
      "The agent is running its first-boot database migrations. This is normal and can take several minutes — keep waiting before changing anything.",
  },
  {
    test: /Server online at|started on port|Netty started|http server started/i,
    fatal: false,
    diagnosis:
      "The agent reports its HTTP server as started. If probes still fail, the problem is between Fly's edge and the machine, not inside the container.",
  },
];

/** Reads the log tail and names the failure in plain language. */
export function classifyLogs(lines: FlyLogLine[]): { diagnosis: string; fatal: boolean } {
  if (!lines.length) {
    return {
      diagnosis:
        "Fly has no log lines for this machine yet. Either it has not produced output, or the log retention window has passed.",
      fatal: false,
    };
  }
  // Newest lines carry the most relevant signal, so read the tail backwards.
  const recent = lines.slice(-400).map((l) => l.message).reverse();
  for (const message of recent) {
    const hit = LOG_RULES.find((rule) => rule.test.test(message));
    if (hit) return { diagnosis: hit.diagnosis, fatal: hit.fatal };
  }
  const errors = recent.filter((m) => /error|exception|fatal/i.test(m));
  if (errors.length) {
    return {
      diagnosis: `No known failure pattern matched, but the log contains errors. Most recent: ${errors[0]?.slice(0, 300)}`,
      fatal: false,
    };
  }
  return {
    diagnosis: "No errors in the recent log tail. The agent looks like it is still starting up.",
    fatal: false,
  };
}

/** Log tail for the Cloud Agent machine (or a named machine) plus a diagnosis. */
export async function getAgentLogs(
  appName: string,
  machineId?: string | null,
): Promise<FlyLogReport> {
  let target = machineId ?? null;
  let machineName: string | null = null;
  let machineState: string | null = null;
  try {
    const machines = await listMachines(appName);
    const picked = target
      ? machines.find((m) => m.id === target)
      : (machines.find((m) => m.name.includes("cloud-agent")) ?? machines[0]);
    if (picked) {
      target = picked.id;
      machineName = picked.name;
      machineState = picked.state;
    }
  } catch {
    /* fall back to whatever machine id we were given */
  }
  const lines = await fetchAppLogs(appName, target);
  const isAgent = !machineName || machineName.includes("cloud-agent");
  let { diagnosis, fatal } = classifyLogs(lines);

  // No output from the agent machine is the loudest signal there is: the JVM
  // never got far enough to log, or the machine is not running at all.
  if (!lines.length && isAgent) {
    diagnosis =
      machineState && machineState !== "started"
        ? `The Cloud Agent machine is "${machineState}" and printed nothing, so it never reached the point of logging. Repair the machine with more memory and start it again.`
        : "The Cloud Agent machine printed no output at all. Either it has not started its process yet, or it exited before logging — check machine diagnostics for the exit code.";
    fatal = Boolean(machineState && machineState !== "started");
  }

  return {
    appName,
    machineId: target,
    machineName,
    machineState,
    producedOutput: lines.length > 0,
    lines: lines.slice(-300),
    diagnosis,
    fatal,
  };
}
