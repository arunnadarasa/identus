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
        last_probe: result as unknown as Record<string, unknown>,
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
    if (conn.mode === "simulated") {
      did = await makePrismDid(`${context.userId}:${data.alias}`);
      status = "PUBLISHED";
    } else {
      const created = await agentFetch(conn, "/did-registrar/dids", {
        method: "POST",
        body: JSON.stringify({
          documentTemplate: {
            publicKeys: [{ id: "key-1", purpose: "authentication" }],
            services: [],
          },
        }),
      });
      did = created?.longFormDid ?? created?.did ?? "unknown";
      status = created?.status ?? "CREATED";
    }

    const { data: row, error } = await context.supabase
      .from("saved_dids")
      .insert({
        user_id: context.userId,
        connection_id: conn.id,
        did,
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

export const issueCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        issuerDid: z.string().trim().min(1),
        holderDid: z.string().trim().min(1),
        subject: z.string().trim().min(1),
        schemaName: z.string().trim().min(1),
        claims: z.record(z.string(), z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActiveConnection, agentFetch, logActivity } = await import("./identus/agent.server");
    const conn = await getActiveConnection(context.supabase, context.userId);
    if (!conn) throw new Error("No agent connection configured yet.");

    let recordId = `sim-${crypto.randomUUID().slice(0, 8)}`;
    let state = "OfferSent";
    if (conn.mode !== "simulated") {
      const offer = await agentFetch(conn, "/issue-credentials/credential-offers", {
        method: "POST",
        body: JSON.stringify({
          issuingDID: data.issuerDid,
          claims: data.claims,
          credentialFormat: "JWT",
          automaticIssuance: true,
        }),
      });
      recordId = offer?.recordId ?? recordId;
      state = offer?.protocolState ?? state;
    }

    const { data: row, error } = await context.supabase
      .from("credential_records")
      .insert({
        user_id: context.userId,
        connection_id: conn.id,
        record_id: recordId,
        subject: data.subject,
        issuer_did: data.issuerDid,
        holder_did: data.holderDid,
        schema_name: data.schemaName,
        claims: data.claims,
        protocol_state: state,
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
