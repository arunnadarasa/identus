import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentConnection, HealthResult } from "./types";

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
  if (conn.base_url) return conn.base_url.replace(/\/$/, "");
  if (conn.mode === "fly" && conn.fly_app_name)
    return `https://${conn.fly_app_name}.fly.dev/cloud-agent`;
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
  try {
    const res = await fetch(`${base}/_system/health`, {
      headers: conn.api_key ? { apikey: conn.api_key } : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const text = (await res.text()).trim();
    if (!res.ok) return { healthy: false, message: `Agent replied ${res.status}: ${text.slice(0, 200)}` };
    let version = text;
    try {
      const parsed = JSON.parse(text);
      version = parsed.version ?? text;
    } catch {
      /* plain text body */
    }
    return { healthy: true, version, message: `Reachable — agent version ${version || "unknown"}.` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      healthy: false,
      message: msg.includes("timed out")
        ? "Timed out. A localhost agent is only reachable from the machine running it."
        : `Could not reach the agent: ${msg}`,
    };
  }
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
