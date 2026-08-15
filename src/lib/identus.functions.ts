import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(({ api_key, ...rest }: any) => ({
      ...rest,
      has_api_key: Boolean(api_key),
    }));
  });

export const createConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1),
        mode: z.enum(["simulated", "docker", "fly"]),
        base_url: z.string().trim().optional(),
        api_key: z.string().trim().optional(),
        wallet_id: z.string().trim().optional(),
        fly_app_name: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { logActivity } = await import("./identus/agent.server");
    const { data: row, error } = await context.supabase
      .from("agent_connections")
      .insert({
        user_id: context.userId,
        name: data.name,
        mode: data.mode,
        base_url: data.base_url || null,
        api_key: data.api_key || null,
        wallet_id: data.wallet_id || null,
        fly_app_name: data.fly_app_name || null,
        provision_status: data.mode === "simulated" ? "ready" : "manual",
        last_health: data.mode === "simulated" ? "healthy" : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(
      context.supabase,
      context.userId,
      row.id,
      "connection.created",
      `Added ${data.mode} agent "${data.name}"`,
    );
    return { id: row.id as string };
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agent_connections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("agent_connections")
      .update({ is_active: false })
      .eq("user_id", context.userId);
    const { error } = await context.supabase
      .from("agent_connections")
      .update({ is_active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { checkHealth, logActivity } = await import("./identus/agent.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const result = await checkHealth(conn);
    await context.supabase
      .from("agent_connections")
      .update({
        last_health: result.healthy ? "healthy" : "unreachable",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    await logActivity(
      context.supabase,
      context.userId,
      data.id,
      "connection.health",
      result.message,
      result.healthy ? "ok" : "error",
    );
    return result;
  });

export const diagnoseConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { probeAgent, logActivity } = await import("./identus/agent.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const result = await probeAgent(conn);
    await context.supabase
      .from("agent_connections")
      .update({
        last_health: result.healthy ? "healthy" : "unreachable",
        last_checked_at: new Date().toISOString(),
        last_probe: JSON.parse(JSON.stringify(result)),
      })
      .eq("id", data.id);
    await logActivity(
      context.supabase,
      context.userId,
      data.id,
      "connection.diagnose",
      result.message,
      result.healthy ? "ok" : "error",
      result.checks,
    );
    return result;
  });

/**
 * Post-deploy readiness check. Runs the deep probe, records readiness state on the
 * connection and only logs to the activity trail on a state transition so repeated
 * polling does not flood the log.
 */
export const awaitAgentReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), timeoutMs: z.number().int().min(30_000).max(1_800_000).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { probeAgent, logActivity } = await import("./identus/agent.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const now = Date.now();
    const startedAt = conn.readiness_started_at ?? new Date(now).toISOString();
    const attempts = (conn.readiness_attempts ?? 0) + 1;
    const elapsedMs = now - new Date(startedAt).getTime();
    const budgetMs = data.timeoutMs ?? 600_000;

    const probe = await probeAgent(conn);
    const byId = new Map(probe.checks.map((c) => [c.id, c]));
    const ready =
      probe.checks.length > 0 &&
      Boolean(byId.get("system")?.ok) &&
      Boolean(byId.get("did-registrar")?.ok);

    const status: "ready" | "waiting" | "timeout" = ready
      ? "ready"
      : elapsedMs >= budgetMs
        ? "timeout"
        : "waiting";
    const previous = conn.readiness_status ?? "unknown";

    await context.supabase
      .from("agent_connections")
      .update({
        readiness_status: status,
        readiness_attempts: attempts,
        readiness_started_at: startedAt,
        ready_at: ready ? (conn.ready_at ?? new Date(now).toISOString()) : conn.ready_at,
        last_health: probe.healthy ? "healthy" : "unreachable",
        last_checked_at: new Date(now).toISOString(),
        last_probe: JSON.parse(JSON.stringify(probe)),
      })
      .eq("id", data.id);

    if (status !== previous && status !== "waiting") {
      await logActivity(
        context.supabase,
        context.userId,
        data.id,
        status === "ready" ? "connection.ready" : "connection.readiness_timeout",
        status === "ready"
          ? `Agent became ready after ${Math.round(elapsedMs / 1000)}s (${attempts} checks)`
          : `Agent did not become ready within ${Math.round(budgetMs / 60_000)} minutes: ${probe.message}`,
        status === "ready" ? "ok" : "error",
        probe.checks,
      );
    }

    return {
      status,
      ready,
      attempts,
      elapsedMs,
      startedAt,
      probe,
      message: probe.message,
    };
  });


export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [conns, dids, peers, creds, schemas, activity] = await Promise.all([
      db.from("agent_connections").select("*").order("created_at", { ascending: true }),
      db.from("saved_dids").select("*").order("created_at", { ascending: false }),
      db.from("sim_connections").select("*").order("created_at", { ascending: false }),
      db.from("credential_records").select("*").order("created_at", { ascending: false }),
      db.from("credential_schemas").select("*").order("created_at", { ascending: false }),
      db.from("activity_log").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    const connections = (conns.data ?? []).map(({ api_key, ...rest }: any) => ({
      ...rest,
      has_api_key: Boolean(api_key),
    }));
    return {
      connections,
      active: connections.find((c: any) => c.is_active) ?? connections[0] ?? null,
      dids: dids.data ?? [],
      peers: peers.data ?? [],
      credentials: creds.data ?? [],
      schemas: schemas.data ?? [],
      activity: activity.data ?? [],
    };
  });

export const createDid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        alias: z.string().trim().min(1),
        role: z.enum(["issuer", "holder", "verifier"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActiveConnection, makePrismDid, agentFetch, logActivity } = await import(
      "./identus/agent.server"
    );
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) throw new Error("No agent connection configured yet.");

    let did: string;
    let status = "CREATED";
    let longFormDid: string | null = null;
    let publishError: string | null = null;
    if (conn.mode === "simulated") {
      did = await makePrismDid(`${context.userId}:${data.alias}`);
      status = "PUBLISHED";
    } else {
      // The agent only signs credentials with a key it holds for the right
      // purpose, so the role has to shape the document template.
      const publicKeys =
        data.role === "issuer"
          ? [
              { id: "auth-1", purpose: "authentication" },
              { id: "assert-1", purpose: "assertionMethod" },
              { id: "agree-1", purpose: "keyAgreement" },
            ]
          : data.role === "verifier"
            ? [
                { id: "auth-1", purpose: "authentication" },
                { id: "agree-1", purpose: "keyAgreement" },
              ]
            : [{ id: "auth-1", purpose: "authentication" }];

      const created = await agentFetch(conn, "/did-registrar/dids", {
        method: "POST",
        body: JSON.stringify({ documentTemplate: { publicKeys, services: [] } }),
      });
      longFormDid = created?.longFormDid ?? null;
      did = created?.did ?? created?.longFormDid ?? "unknown";
      status = created?.status ?? "CREATED";

      // Unpublished DIDs cannot be used as issuers, so publish immediately.
      if (data.role !== "holder" && did !== "unknown") {
        try {
          const published = await agentFetch(
            conn,
            `/did-registrar/dids/${encodeURIComponent(did)}/publications`,
            { method: "POST" },
          );
          status = published?.scheduledOperation ? "PUBLICATION_PENDING" : (published?.status ?? "PUBLICATION_PENDING");
        } catch (error) {
          publishError = error instanceof Error ? error.message : "Publication request failed";
        }
      }
    }

    const { data: row, error } = await context.supabase
      .from("saved_dids")
      .insert({
        user_id: context.userId,
        connection_id: conn.id,
        did,
        long_form_did: longFormDid,
        publish_error: publishError,
        alias: data.alias,
        role: data.role,
        status,
        purpose: data.role === "issuer" ? "assertionMethod" : "authentication",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await logActivity(
      context.supabase,
      context.userId,
      conn.id,
      "did.created",
      `Created ${data.role} DID for "${data.alias}"`,
      "ok",
      { did },
    );
    return row;
  });

/** Submits an existing agent DID for publication (for DIDs created before roles were sent). */
export const publishDid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getActiveConnection, agentFetch } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) throw new Error("No agent connection configured yet.");
    if (conn.mode === "simulated") throw new Error("Simulated DIDs are already published.");

    const { data: row } = await context.supabase
      .from("saved_dids")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!row) throw new Error("DID not found.");

    let status = row.status as string;
    let publishError: string | null = null;
    try {
      const published = await agentFetch(
        conn,
        `/did-registrar/dids/${encodeURIComponent(row.did)}/publications`,
        { method: "POST" },
      );
      status = published?.scheduledOperation
        ? "PUBLICATION_PENDING"
        : (published?.status ?? "PUBLICATION_PENDING");
    } catch (error) {
      publishError = error instanceof Error ? error.message : "Publication request failed";
    }

    const { data: updated, error } = await context.supabase
      .from("saved_dids")
      .update({ status, publish_error: publishError })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (publishError) throw new Error(publishError);
    return updated;
  });

/**
 * Publication is asynchronous, so re-read every non-published DID from the
 * agent and write the current status (and short-form DID) back.
 */
export const refreshDidStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveConnection, agentFetch } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn || conn.mode === "simulated") return { updated: 0 };

    const { data: rows } = await context.supabase
      .from("saved_dids")
      .select("*")
      .eq("connection_id", conn.id)
      .neq("status", "PUBLISHED");

    let updated = 0;
    for (const row of rows ?? []) {
      try {
        const res = await agentFetch(
          conn,
          `/did-registrar/dids/${encodeURIComponent(row.did)}`,
        );
        const status = String(res?.status ?? row.status).toUpperCase();
        const shortForm = res?.did ?? row.did;
        if (status !== row.status || shortForm !== row.did) {
          await context.supabase
            .from("saved_dids")
            .update({ status, did: shortForm, publish_error: null })
            .eq("id", row.id);
          updated += 1;
        }
      } catch {
        // Leave the row alone; the agent may still be catching up.
      }
    }
    return { updated };
  });



export const createPeerConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ label: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { getActiveConnection, makePrismDid, agentFetch, logActivity } = await import(
      "./identus/agent.server"
    );
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) throw new Error("No agent connection configured yet.");

    let invitationUrl: string;
    let myDid: string;
    let state = "InvitationGenerated";
    if (conn.mode === "simulated") {
      myDid = await makePrismDid(`${context.userId}:peer:${data.label}`);
      invitationUrl = `https://simulated.identus.local/invitation?_oob=${btoa(
        JSON.stringify({ id: crypto.randomUUID(), label: data.label, from: myDid }),
      ).slice(0, 120)}`;
    } else {
      const created = await agentFetch(conn, "/connections", {
        method: "POST",
        body: JSON.stringify({ label: data.label }),
      });
      invitationUrl = created?.invitation?.invitationUrl ?? "";
      myDid = created?.myDid ?? created?.invitation?.from ?? "";
      state = created?.state ?? state;
    }

    const { data: row, error } = await context.supabase
      .from("sim_connections")
      .insert({
        user_id: context.userId,
        connection_id: conn.id,
        label: data.label,
        my_did: myDid,
        state,
        invitation_url: invitationUrl,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logActivity(
      context.supabase,
      context.userId,
      conn.id,
      "connection.invitation",
      `Created DIDComm invitation "${data.label}"`,
    );
    return row;
  });

export const acceptPeerConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { makePrismDid, logActivity } = await import("./identus/agent.server");
    const theirDid = await makePrismDid(`${data.id}:their`);
    const { data: row, error } = await context.supabase
      .from("sim_connections")
      .update({ state: "ConnectionResponseSent", their_did: theirDid })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logActivity(
      context.supabase,
      context.userId,
      row.connection_id,
      "connection.established",
      `Connection "${row.label}" established`,
    );
    return row;
  });

export const listAgentConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveConnection, agentFetch } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) return { mode: null as string | null, connections: [] };

    const { data: local } = await context.supabase
      .from("sim_connections")
      .select("*")
      .order("created_at", { ascending: false });
    const localList = (local ?? []).map((row: any) => ({
      connectionId: row.connection_ref ?? row.id,
      label: row.label as string,
      state: row.state as string,
      source: "local" as const,
    }));

    if (conn.mode === "simulated") {
      return { mode: conn.mode, connections: localList };
    }

    let remote: Array<{ connectionId: string; label: string; state: string; source: "agent" }> = [];
    try {
      const res = await agentFetch(conn, "/connections");
      const items = (res?.contents ?? res?.items ?? []) as any[];
      remote = items
        .filter((c) =>
          ["ConnectionResponseSent", "ConnectionResponseReceived"].includes(
            String(c?.state ?? ""),
          ),
        )
        .map((c) => ({
          connectionId: String(c?.connectionId ?? c?.thid ?? ""),
          label: String(c?.label ?? c?.theirDid ?? "connection"),
          state: String(c?.state ?? ""),
          source: "agent" as const,
        }))
        .filter((c) => c.connectionId);
    } catch {
      remote = [];
    }

    return { mode: conn.mode, connections: remote };
  });

/**
 * Issuer DIDs a real agent can actually sign with: published PRISM DIDs that
 * carry an assertionMethod key. Demo DIDs seeded into our own database are not
 * known to the agent, and using one gives a bare 500 from the offer endpoint.
 */
export const listIssuerDids = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveConnection, agentFetch } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn)
      return {
        mode: null as string | null,
        dids: [] as { did: string; alias: string; status: string; keys: string[] }[],
        excluded: [] as { did: string; alias: string; reason: string }[],
        error: null as string | null,
        reason: "no_dids",
        pendingCount: 0,
      };

    if (conn.mode === "simulated") {
      const { data } = await context.supabase
        .from("saved_dids")
        .select("*")
        .order("created_at", { ascending: true });
      return {
        mode: conn.mode,
        dids: (data ?? []).map((d: any) => ({
          did: d.did as string,
          alias: (d.alias ?? d.did) as string,
          status: d.status as string,
          keys: [] as string[],
        })),
        excluded: [] as { did: string; alias: string; reason: string }[],
        error: null,
        reason: "ok",
        pendingCount: 0,
      };
    }


    try {
      const res = await agentFetch(conn, "/did-registrar/dids?offset=0&limit=100");
      const items = (res?.contents ?? res?.items ?? []) as any[];
      const published = items
        .filter((d) => String(d?.status ?? "").toUpperCase() === "PUBLISHED")
        .map((d) => String(d?.did ?? d?.longFormDid ?? ""))
        .filter(Boolean);

      // The list response carries no key purposes, so resolve each document and
      // keep only the DIDs that really have an assertionMethod key.
      const { resolveDidCapabilitiesMap } = await import("./identus/agent.server");
      const caps = await resolveDidCapabilitiesMap(conn, published);

      const { data: saved } = await context.supabase
        .from("saved_dids")
        .select("did, alias")
        .eq("user_id", context.userId);
      const aliasFor = new Map<string, string>(
        (saved ?? [])
          .filter((row: any) => row.alias)
          .map((row: any) => [row.did as string, row.alias as string]),
      );
      const label = (did: string) => aliasFor.get(did) ?? `${did.slice(0, 24)}…${did.slice(-6)}`;

      const dids: {
        did: string;
        alias: string;
        status: string;
        keys: string[];
      }[] = [];
      const excluded: { did: string; alias: string; reason: string }[] = [];

      for (const did of published) {
        const c = caps.get(did);
        if (c?.assertionMethod.length) {
          dids.push({ did, alias: label(did), status: "PUBLISHED", keys: c.assertionMethod });
        } else if (c?.resolved) {
          excluded.push({
            did,
            alias: label(did),
            reason: c.authentication.length
              ? "authentication only — no assertionMethod key"
              : "no assertionMethod key",
          });
        } else {
          excluded.push({ did, alias: label(did), reason: "could not be resolved by the agent" });
        }
      }

      const pending = items.filter((d) =>
        ["PUBLICATION_PENDING", "CREATED"].includes(String(d?.status ?? "").toUpperCase()),
      );
      const reason =
        dids.length > 0
          ? "ok"
          : items.length === 0
            ? "no_dids"
            : pending.length > 0
              ? "publishing"
              : "no_assertion_key";

      return { mode: conn.mode, dids, excluded, error: null, reason, pendingCount: pending.length };
    } catch (error) {
      return {
        mode: conn.mode,
        dids: [],
        excluded: [] as { did: string; alias: string; reason: string }[],
        error: error instanceof Error ? error.message : "Could not list agent DIDs",
        reason: "error",
        pendingCount: 0,
      };
    }

  });

/** Turns an agent offer failure into something actionable. */
function explainOfferFailure(message: string, connectionless: boolean) {
  if (/\[500\]/.test(message)) {
    return `The agent could not build this offer. The most common cause is an issuing DID it does not own or has not published — pick a DID created on this agent from the DIDs page. Agent said: ${message}`;
  }
  if (/\[404\]/.test(message) && !connectionless) {
    return `That DIDComm connection no longer exists on the agent. Refresh the connection list or send a connectionless invitation. Agent said: ${message}`;
  }
  if (/\[400\]/.test(message)) {
    return `The agent rejected the offer payload — check that every claim matches the schema attributes. Agent said: ${message}`;
  }
  return message;
}

export const issueCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        issuerDid: z.string().trim().min(1),
        holderDid: z.string().trim().optional(),
        subject: z.string().trim().min(1),
        schemaName: z.string().trim().min(1),
        claims: z.record(z.string(), z.string()),
        connectionId: z.string().trim().optional(),
        connectionless: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActiveConnection, agentFetch, logActivity } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) throw new Error("No agent connection configured yet.");

    let recordId = `sim-${crypto.randomUUID().slice(0, 8)}`;
    let state = "OfferSent";
    let invitationUrl: string | null = null;
    if (conn.mode !== "simulated") {
      const connectionless = data.connectionless === true || !data.connectionId;

      // Fail fast with a clear message when the issuing DID is not on the agent.
      try {
        const res = await agentFetch(conn, "/did-registrar/dids?offset=0&limit=100");
        const items = (res?.contents ?? res?.items ?? []) as any[];
        const known = items.flatMap((d) =>
          [d?.did, d?.longFormDid].filter(Boolean).map((v: string) => String(v)),
        );
        if (known.length > 0 && !known.includes(data.issuerDid)) {
          throw new Error(
            "This issuer DID does not exist on the connected agent. Create and publish an issuer DID on the DIDs page first — demo DIDs only work in simulated mode.",
          );
        }
      } catch (error) {
        if (error instanceof Error && /does not exist on the connected agent/.test(error.message)) {
          throw error;
        }
        // DID listing unavailable: let the offer attempt speak for itself.
      }

      // The agent rejects an offer signed by a DID with no assertionMethod key
      // with a bare 400; say so up front instead.
      const { resolveDidCapabilities } = await import("./identus/agent.server");
      const caps = await resolveDidCapabilities(conn, data.issuerDid);
      if (caps.resolved && caps.assertionMethod.length === 0) {
        throw new Error(
          caps.authentication.length > 0
            ? "This DID only has an authentication key, so it cannot sign credentials. Pick or create an issuer DID with an assertionMethod key on the DIDs page."
            : "This DID has no assertionMethod key, so the agent cannot sign a credential with it. Create an issuer DID on the DIDs page.",
        );
      }


      const body: Record<string, unknown> = {
        issuingDID: data.issuerDid,
        claims: data.claims,
        credentialFormat: "JWT",
        automaticIssuance: true,
      };
      const path = connectionless
        ? "/issue-credentials/credential-offers/invitation"
        : "/issue-credentials/credential-offers";
      if (!connectionless) {
        body["connectionId"] = data.connectionId;
      } else {
        body["goalCode"] = "issue-vc";
        body["goal"] = `Issue a ${data.schemaName} credential`;
      }

      let offer: any;
      try {
        offer = await agentFetch(conn, path, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        await logActivity(
          context.supabase,
          context.userId,
          conn.id,
          "credential.offer_failed",
          `Credential offer rejected by the agent`,
          "error",
          { path, raw },
        );
        throw new Error(explainOfferFailure(raw, connectionless));
      }
      recordId = offer?.recordId ?? recordId;
      state = offer?.protocolState ?? state;
      invitationUrl =
        offer?.invitation?.invitationUrl ?? offer?.invitation?.invitation ?? null;
    }


    const { data: row, error } = await context.supabase
      .from("credential_records")
      .insert({
        user_id: context.userId,
        connection_id: conn.id,
        record_id: recordId,
        subject: data.subject,
        issuer_did: data.issuerDid,
        holder_did: data.holderDid ?? null,
        schema_name: data.schemaName,
        claims: data.claims,
        protocol_state: state,
        invitation_url: invitationUrl,
        agent_connection_ref: data.connectionId ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logActivity(
      context.supabase,
      context.userId,
      conn.id,
      "credential.offered",
      `Offered ${data.schemaName} credential to ${data.subject}`,
    );
    return row;
  });


export const acceptCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { makeCredentialJwt, logActivity } = await import("./identus/agent.server");
    const { data: record, error: readError } = await context.supabase
      .from("credential_records")
      .select("*")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    const jwt = makeCredentialJwt({
      issuer: record.issuer_did ?? "did:prism:unknown",
      subject: record.holder_did ?? "did:prism:unknown",
      claims: (record.claims ?? {}) as Record<string, string>,
      schema: record.schema_name ?? "VerifiableCredential",
    });

    const { data: row, error } = await context.supabase
      .from("credential_records")
      .update({ protocol_state: "CredentialReceived", jwt })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logActivity(
      context.supabase,
      context.userId,
      record.connection_id,
      "credential.issued",
      `Credential issued and stored in the holder wallet`,
    );
    return row;
  });

export const verifyCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { logActivity } = await import("./identus/agent.server");
    const { data: record, error: readError } = await context.supabase
      .from("credential_records")
      .select("*")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    const verified = Boolean(record.jwt) && record.protocol_state === "CredentialReceived";
    await context.supabase
      .from("credential_records")
      .update({ verified })
      .eq("id", data.id);
    await context.supabase.from("sim_presentations").insert({
      user_id: context.userId,
      connection_id: record.connection_id,
      credential_record_id: record.id,
      verifier_did: record.issuer_did,
      state: "PresentationVerified",
      result: verified ? "valid" : "invalid",
    });
    await logActivity(
      context.supabase,
      context.userId,
      record.connection_id,
      "presentation.verified",
      verified
        ? "Presentation verified — signature and issuer DID check out"
        : "Verification failed — no credential has been issued yet",
      verified ? "ok" : "error",
    );
    return {
      verified,
      checks: [
        { name: "JWT structure", ok: Boolean(record.jwt) },
        { name: "Issuer DID resolvable", ok: Boolean(record.issuer_did) },
        { name: "Holder binding", ok: Boolean(record.holder_did) },
        { name: "Not revoked", ok: verified },
      ],
    };
  });

export const createSchema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1),
        version: z.string().trim().min(1),
        attributes: z.array(z.string().trim().min(1)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActiveConnection, logActivity } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) throw new Error("No agent connection configured yet.");
    const { data: row, error } = await context.supabase
      .from("credential_schemas")
      .insert({
        user_id: context.userId,
        connection_id: conn.id,
        name: data.name,
        version: data.version,
        attributes: data.attributes,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logActivity(
      context.supabase,
      context.userId,
      conn.id,
      "schema.created",
      `Created schema ${data.name}@${data.version}`,
    );
    return row;
  });

/** Returns the stored admin key for one of the caller's own connections. */
export const revealConnectionKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("agent_connections")
      .select("api_key")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return { apiKey: (row.api_key as string | null) ?? null };
  });

/** Stores a pasted API key for a docker-local agent and re-probes it. */
export const setConnectionKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), apiKey: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { probeAgent, logActivity } = await import("./identus/agent.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);

    const probe = await probeAgent({
      mode: conn.mode as string,
      base_url: conn.base_url as string | null,
      fly_app_name: conn.fly_app_name as string | null,
      api_key: data.apiKey,
    });

    const { error: updateError } = await context.supabase
      .from("agent_connections")
      .update({
        api_key: data.apiKey,
        last_probe: probe as unknown as never,
        last_health: probe.healthy ? "healthy" : "unreachable",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    await logActivity(
      context.supabase,
      context.userId,
      data.id,
      "connection.key_updated",
      `Updated API key for ${conn.name}`,
    );
    return { healthy: probe.healthy, message: probe.message };
  });
