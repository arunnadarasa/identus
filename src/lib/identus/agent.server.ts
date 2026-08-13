import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentConnection, HealthResult, ProbeCheck, ProbeResult } from "./types";

type DB = SupabaseClient<any, "public", any>;

const enc = new TextEncoder();

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function makePrismDid(seed: string) {
  return `did:prism:${await sha256Hex(seed + Math.random().toString(36))}`;
}

function b64url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makeCredentialJwt(payload: {
  issuer: string;
  subject: string;
  claims: Record<string, string>;
  schema: string;
}) {
  const header = b64url(JSON.stringify({ alg: "ES256K", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({
      iss: payload.issuer,
      sub: payload.subject,
      nbf: Math.floor(Date.now() / 1000),
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", payload.schema],
        credentialSubject: { id: payload.subject, ...payload.claims },
      },
    }),
  );
  return `${header}.${body}.${b64url("simulated-signature-" + Date.now())}`;
}

export function agentBaseUrl(conn: Pick<AgentConnection, "base_url" | "mode" | "fly_app_name">) {
  // Fly deployments talk straight to the agent machine, which serves its API at
  // the root. The `/cloud-agent` prefix only exists in the upstream compose
  // stack (an APISIX gateway adds it), so strip it from stored Fly URLs.
  const normalise = (url: string) =>
    url.replace(/\/$/, "").replace(/\/cloud-agent$/, "");
  if (conn.base_url) {
    const trimmed = conn.base_url.replace(/\/$/, "");
    return conn.mode === "fly" ? normalise(trimmed) : trimmed;
  }
  if (conn.mode === "fly" && conn.fly_app_name)
    return `https://${conn.fly_app_name}.fly.dev`;
  return "";
}


/** Raw REST call against a real Identus Cloud Agent. */
export async function agentFetch(
  conn: { base_url: string | null; mode: string; fly_app_name: string | null; api_key?: string | null },
  path: string,
  init: RequestInit = {},
) {
  const base = agentBaseUrl(conn as AgentConnection);
  if (!base) throw new Error("This agent connection has no base URL configured.");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (conn.api_key) headers.set("apikey", conn.api_key);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Agent request failed [${res.status}] ${path}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Turns a failed fetch into text that says what actually went wrong. "down" on
 * its own is useless: a DNS failure, a TCP timeout and a TLS error each mean a
 * different fix.
 */
function describeFetchFailure(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || /timed out|timeout/i.test(msg)) {
    return "No response before the timeout — nothing is listening behind this URL (a localhost agent is only reachable from the machine running it).";
  }
  if (/ENOTFOUND|getaddrinfo|dns/i.test(msg)) {
    return "Hostname could not be resolved — check the agent URL.";
  }
  if (/ECONNREFUSED|refused/i.test(msg)) {
    return "Connection refused — the host answered but no service is bound to that port.";
  }
  if (/certificate|TLS|SSL/i.test(msg)) {
    return `TLS handshake failed: ${msg.slice(0, 140)}`;
  }
  if (/ECONNRESET|socket hang up/i.test(msg)) {
    return "Connection reset mid-request — the service accepted the socket then dropped it, which usually means it is still starting.";
  }
  return `Request failed: ${msg.slice(0, 160)}`;
}

/** Explains a non-2xx reply from the agent in terms of the likely cause. */
function describeHttpFailure(status: number, body: string) {
  const snippet = body.replace(/\s+/g, " ").slice(0, 160);
  if (status === 401 || status === 403) return "API key rejected by the agent";
  if (status === 404)
    return `HTTP 404 — the agent answered but this path does not exist on it. ${snippet}`;
  if (status === 502 || status === 503)
    return `HTTP ${status} — Fly's edge has no healthy instance for this app yet (the container is down or still booting). ${snippet}`;
  if (status === 504) return `HTTP 504 — the machine accepted the request but never replied in time.`;
  return `HTTP ${status} ${snippet}`;
}

/**
 * Identus serves its API at the root when the machine is hit directly, but the
 * upstream compose stack fronts it with a gateway that adds `/cloud-agent`.
 * Trying both rules out a whole class of false "down" readings on adopted or
 * gateway-fronted agents.
 */
const PATH_PREFIXES = ["", "/cloud-agent"] as const;

async function probeOnce(url: string, apiKey: string | null | undefined, timeoutMs: number) {
  const res = await fetch(url, {
    headers: apiKey ? { apikey: apiKey } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = (await res.text()).trim();
  return { res, text };
}

/** Finds which path prefix the agent answers health on, if any. */
async function resolvePrefix(
  base: string,
  apiKey: string | null | undefined,
  timeoutMs: number,
): Promise<{ prefix: string; res?: Response; text?: string; failure: string }> {
  let failure = "";
  for (const prefix of PATH_PREFIXES) {
    try {
      const { res, text } = await probeOnce(`${base}${prefix}/_system/health`, apiKey, timeoutMs);
      if (res.ok) return { prefix, res, text, failure: "" };
      // A 401 still proves something is listening on this prefix.
      if (res.status === 401 || res.status === 403) return { prefix, res, text, failure: "" };
      failure = describeHttpFailure(res.status, text);
    } catch (error) {
      failure = describeFetchFailure(error);
      // A transport failure will repeat on every prefix, so stop early.
      break;
    }
  }
  return { prefix: PATH_PREFIXES[0], failure };
}

export async function checkHealth(conn: {
  mode: string;
  base_url: string | null;
  fly_app_name: string | null;
  api_key?: string | null;
}): Promise<HealthResult> {
  if (conn.mode === "simulated") {
    return { healthy: true, version: "simulated-1.0", message: "Simulated agent is always available." };
  }
  const base = agentBaseUrl(conn as AgentConnection);
  if (!base) return { healthy: false, message: "No base URL configured for this agent." };
  const resolved = await resolvePrefix(base, conn.api_key, 10000);
  if (!resolved.res) return { healthy: false, message: resolved.failure || "Could not reach the agent." };
  const text = resolved.text ?? "";
  if (!resolved.res.ok) {
    return { healthy: false, message: describeHttpFailure(resolved.res.status, text) };
  }
  let version = text;
  try {
    version = JSON.parse(text).version ?? text;
  } catch {
    /* plain text body */
  }
  return {
    healthy: true,
    version,
    message: `Reachable at ${base}${resolved.prefix} — agent version ${version || "unknown"}.`,
  };
}

const PROBE_CHECKS = [
  { id: "system", label: "System health", path: "/_system/health" },
  { id: "did-registrar", label: "DID registrar", path: "/did-registrar/dids?offset=0&limit=1" },
  { id: "issuance", label: "Credential issuance", path: "/issue-credentials/records?offset=0&limit=1" },
  { id: "connections", label: "DIDComm connections", path: "/connections?offset=0&limit=1" },
] as const;

/** Deep diagnostic probe: hits several Cloud Agent endpoints and records status + latency. */
export async function probeAgent(conn: {
  mode: string;
  base_url: string | null;
  fly_app_name: string | null;
  api_key?: string | null;
}): Promise<ProbeResult> {
  const startedAt = new Date().toISOString();

  if (conn.mode === "simulated") {
    return {
      healthy: true,
      version: "simulated-1.0",
      message: "Simulated agent — all checks pass in-app.",
      totalMs: 0,
      startedAt,
      checks: PROBE_CHECKS.map((c) => ({
        id: c.id,
        label: c.label,
        ok: true,
        ms: 0,
        detail: "in-app runtime",
      })),
    };
  }

  const base = agentBaseUrl(conn as AgentConnection);
  if (!base) {
    return {
      healthy: false,
      message: "No base URL configured for this agent.",
      totalMs: 0,
      startedAt,
      checks: [],
    };
  }

  const t0 = Date.now();
  let version: string | undefined;
  const checks: ProbeCheck[] = [];
  const resolved = await resolvePrefix(base, conn.api_key, 6000);
  const prefix = resolved.prefix;

  for (const check of PROBE_CHECKS) {
    const started = Date.now();
    try {
      const { res, text } = await probeOnce(
        `${base}${prefix}${check.path}`,
        conn.api_key,
        6000,
      );
      const ms = Date.now() - started;
      if (check.id === "system" && res.ok) {
        try {
          version = JSON.parse(text).version ?? text;
        } catch {
          version = text;
        }
      }
      checks.push({
        id: check.id,
        label: check.label,
        ok: res.ok,
        status: res.status,
        ms,
        detail: res.ok
          ? check.id === "system"
            ? `version ${version || "unknown"}${prefix ? ` at ${prefix}` : ""}`
            : `HTTP ${res.status}`
          : describeHttpFailure(res.status, text),
      });
    } catch (error) {
      checks.push({
        id: check.id,
        label: check.label,
        ok: false,
        ms: Date.now() - started,
        detail: describeFetchFailure(error),
      });
    }
  }

  const systemOk = checks.find((c) => c.id === "system")?.ok ?? false;
  const failed = checks.filter((c) => !c.ok);
  return {
    healthy: systemOk && failed.length === 0,
    version,
    totalMs: Date.now() - t0,
    startedAt,
    checks,
    message: !systemOk
      ? `Agent is not responding — ${checks.find((c) => c.id === "system")?.detail ?? "no reply"}`
      : failed.length
        ? `Agent is up${prefix ? ` (under ${prefix})` : ""} but ${failed.length} of ${checks.length} checks failed (${failed
            .map((c) => c.label)
            .join(", ")}).`
        : `All ${checks.length} checks passed — agent version ${version || "unknown"}.`,
  };
}

export async function logActivity(
  db: DB,
  userId: string,
  connectionId: string | null,
  kind: string,
  summary: string,
  status: "ok" | "error" = "ok",
  detail?: unknown,
) {
  await db.from("activity_log").insert({
    user_id: userId,
    connection_id: connectionId,
    kind,
    summary,
    status,
    detail: detail ?? null,
  });
}

export async function getActiveConnection(db: DB, userId: string) {
  const { data } = await db
    .from("agent_connections")
    .select("*")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}
