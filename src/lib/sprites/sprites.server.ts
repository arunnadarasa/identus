/**
 * Minimal REST client for sprites.dev micro-sandboxes.
 *
 * Only the endpoints the SDK scratch box needs. Quirks that matter:
 *  - create is POST-only (`PUT /sprites/{name}` → 404)
 *  - services are PUT-addressed and need `http_port` for wake-on-request
 *  - `exec` must send Authorization ONLY (an Accept header → 406) and its body
 *    is raw bytes ending with `0x03 <exitCode>`
 *  - `PUT /fs/write` creates parent directories, so no mkdir exec is needed
 *  - services must run from `/root/www` (`/home/sprite` may not exist)
 */

const API = "https://api.sprites.dev/v1";

export const SPRITE_DIR = "/root/www";
export const SPRITE_SERVICE = "webapp";

/** Per-call budgets. Nothing here may block a provision request forever. */
export const TIMEOUTS = {
  lookup: 20_000,
  write: 30_000,
  service: 25_000,
  start: 30_000,
  exec: 120_000,
  install: 240_000,
} as const;

export class SpritesTimeoutError extends Error {
  endpoint: string;
  timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number) {
    super(
      `The sandbox API did not answer ${endpoint} within ${Math.round(timeoutMs / 1000)}s. The box may be waking up — retry, or use Repair box.`,
    );
    this.name = "SpritesTimeoutError";
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}

/** Runs a fetch with an abort budget and converts an abort into a readable error. */
async function timedFetch(
  endpoint: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new SpritesTimeoutError(endpoint, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class SpritesApiError extends Error {
  status: number;
  raw: string;
  endpoint: string;

  constructor(endpoint: string, status: number, raw: string) {
    super(
      status === 401
        ? "Sprites authentication failed. The SPRITES_TOKEN must be the 4-part token (org-slug/org-id/token-id/token-value) from sprites.dev/account — a raw Fly.io token will not work."
        : `Sprites API ${status} on ${endpoint}: ${raw.slice(0, 500) || "(empty body)"}`,
    );
    this.name = "SpritesApiError";
    this.status = status;
    this.raw = raw;
    this.endpoint = endpoint;
  }
}

function token() {
  // Read inside the call, never at module scope — env is injected per request.
  const value = process.env["SPRITES_TOKEN"];
  if (!value) {
    throw new Error(
      "SPRITES_TOKEN is not set. Add the 4-part token from sprites.dev/account to use the SDK sandbox.",
    );
  }
  return value;
}

function authHeaders() {
  return { Authorization: `Bearer ${token()}` };
}

async function request(
  path: string,
  init: RequestInit & { rawBody?: boolean; timeoutMs?: number } = {},
): Promise<{ status: number; text: string; json: any }> {
  const { timeoutMs, ...rest } = init;
  const res = await timedFetch(
    path,
    `${API}${path}`,
    { ...rest, headers: { ...authHeaders(), ...(init.headers ?? {}) } },
    timeoutMs ?? TIMEOUTS.lookup,
  );
  const text = await res.text();
  if (!res.ok) throw new SpritesApiError(path, res.status, text);
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

export interface SpriteInfo {
  name: string;
  status: string;
  url: string | null;
}

function readUrl(body: any): string | null {
  if (!body) return null;
  if (typeof body.url === "string" && body.url) {
    return body.url.startsWith("http") ? body.url : `https://${body.url}`;
  }
  if (typeof body.hostname === "string" && body.hostname) return `https://${body.hostname}`;
  return null;
}

/** `null` when the sprite does not exist yet. */
export async function getSprite(name: string): Promise<SpriteInfo | null> {
  try {
    const { json } = await request(`/sprites/${name}`);
    return { name, status: String(json?.status ?? "unknown"), url: readUrl(json) };
  } catch (error) {
    if (error instanceof SpritesApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createSprite(name: string): Promise<SpriteInfo> {
  const { json } = await request(`/sprites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url_settings: { auth: "public" } }),
  });
  return { name, status: String(json?.status ?? "created"), url: readUrl(json) };
}

export async function deleteSprite(name: string) {
  try {
    await request(`/sprites/${name}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof SpritesApiError && error.status === 404) return;
    throw error;
  }
}

export async function writeFile(name: string, path: string, content: string) {
  await request(
    `/sprites/${name}/fs/write?path=${encodeURIComponent(path)}&workingDir=/`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: content,
    },
  );
}

export async function putService(
  name: string,
  service: string,
  body: { cmd: string; args: string[]; dir: string; http_port: number },
) {
  // A stale definition keeps the old command/port bound; remove it first.
  try {
    await request(`/sprites/${name}/services/${service}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof SpritesApiError && [404, 405].includes(error.status))) throw error;
  }
  await request(`/sprites/${name}/services/${service}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ needs: [], ...body }),
  });
}

/** Starts a service and surfaces the first NDJSON error/exit frame, if any. */
export async function startService(name: string, service: string) {
  const res = await fetch(`${API}/sprites/${name}/services/${service}/start`, {
    method: "POST",
    headers: { ...authHeaders(), Accept: "application/x-ndjson" },
  });
  const text = await res.text();
  if (!res.ok) throw new SpritesApiError(`/services/${service}/start`, res.status, text);

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let frame: any;
    try {
      frame = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (frame?.type === "error") {
      throw new Error(`Service failed to start: ${frame.message ?? trimmed}`);
    }
    if (frame?.type === "exit" && frame.exit_code && frame.exit_code !== 0) {
      throw new Error(`Service exited with code ${frame.exit_code}: ${trimmed}`);
    }
  }
  return text;
}

export interface ExecResult {
  stdout: string;
  exitCode: number | null;
}

/** Runs a bash script inside the sprite over HTTP. */
export async function exec(name: string, script: string): Promise<ExecResult> {
  const qs = new URLSearchParams();
  qs.append("cmd", "bash");
  qs.append("cmd", "-lc");
  qs.append("cmd", script);

  const res = await fetch(`${API}/sprites/${name}/exec?${qs.toString()}`, {
    method: "POST",
    headers: authHeaders(), // Authorization only — an Accept header returns 406.
  });
  if (!res.ok) {
    throw new SpritesApiError("/exec", res.status, await res.text());
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const hasExit = bytes.length >= 2 && bytes[bytes.length - 2] === 3;
  const exitCode = hasExit ? (bytes[bytes.length - 1] ?? null) : null;
  const stdout = new TextDecoder().decode(hasExit ? bytes.slice(0, -2) : bytes);
  return { stdout, exitCode };
}

/** Polls the public URL so the box is awake before we hand it to the user. */
export async function warmUrl(url: string, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {
      // cold boot — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return false;
}

/** Shell-safe env export line: values travel as base64 so quoting can't break. */
export function envExport(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([key, value]) => {
      const b64 = Buffer.from(value ?? "", "utf8").toString("base64");
      return `export ${key}="$(printf %s '${b64}' | base64 -d)"`;
    })
    .join("; ");
}
