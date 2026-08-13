import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const flyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listOrganizations } = await import("./fly.server");
    try {
      const orgs = await listOrganizations();
      return { ok: true as const, orgs };
    } catch (error) {
      return {
        ok: false as const,
        orgs: [] as { id: string; slug: string; name: string }[],
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

export const flyPreflight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ appName: z.string().trim().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listOrganizations, appExists, suggestAppName } = await import("./fly.server");
    try {
      const orgs = await listOrganizations();
      let taken = false;
      const suggested = suggestAppName();
      if (data.appName && /^[a-z0-9-]{4,40}$/.test(data.appName)) {
        taken = await appExists(data.appName);
      }
      return { ok: true as const, orgs, taken, suggested, message: "" };
    } catch (error) {
      return {
        ok: false as const,
        orgs: [] as { id: string; slug: string; name: string }[],
        taken: false,
        suggested: "",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

export const provisionFlyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appName: z
          .string()
          .trim()
          .regex(/^[a-z0-9-]{4,40}$/, "Use lowercase letters, numbers and dashes only."),
        orgSlug: z.string().trim().min(1),
        region: z.string().trim().min(2),
        adminKey: z.string().trim().min(8).max(200).optional(),
        pgPassword: z.string().trim().min(8).max(200).optional(),
        cpus: z.number().int().min(1).max(8).optional(),
        memoryMb: z.number().int().min(512).max(8192).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const {
      fly,
      FlyApiError,
      describeFlyError,
      allocateSharedIpv4,
      postgresMachineConfig,
      prismNodeMachineConfig,
      agentMachineConfig,
      waitForMachineState,
    } = await import("./fly.server");

    type Step = import("./fly.server").Step;
    const { logActivity } = await import("./agent.server");

    const steps: Step[] = [];
    const password = data.pgPassword ?? crypto.randomUUID().replace(/-/g, "");
    const adminKey = data.adminKey ?? crypto.randomUUID().replace(/-/g, "");
    // The Cloud Agent is a JVM service that migrates four databases on first
    // boot; 2 GB gets OOM-killed, so 4 GB is the default.
    const guest = { cpus: data.cpus ?? 2, memoryMb: data.memoryMb ?? 4096 };

    // Fly private DNS resolves process groups, not machine names. The machine's
    // private 6PN address is used when the create call returns one, since it is
    // available immediately and does not wait on DNS propagation.
    let pgHost = `postgres.process.${data.appName}.internal`;
    let prismHost = `prism-node.process.${data.appName}.internal`;

    const { data: conn, error: insertError } = await context.supabase
      .from("agent_connections")
      .insert({
        user_id: context.userId,
        name: `Fly · ${data.appName}`,
        mode: "fly",
        base_url: `https://${data.appName}.fly.dev`,
        api_key: adminKey,
        fly_app_name: data.appName,
        fly_region: data.region,
        provision_status: "provisioning",
        provision_log: [],
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    const persist = async (status: string) => {
      await context.supabase
        .from("agent_connections")
        .update({ provision_status: status, provision_log: steps as unknown as never })
        .eq("id", conn.id);
    };

    /**
     * Records the step as `running` before the call so a stalled or crashed step
     * is visible in the live log, then rewrites it with the outcome, duration and
     * — on failure — the full Fly response body.
     */
    const runStep = async <T>(
      name: string,
      endpoint: string,
      fn: () => Promise<T>,
      detail?: (result: T) => string,
    ): Promise<T> => {
      const entry: Step = {
        step: name,
        status: "running",
        at: new Date().toISOString(),
        endpoint,
      };
      steps.push(entry);
      await persist("provisioning");
      const started = Date.now();
      try {
        const result = await fn();
        entry.status = "ok";
        entry.durationMs = Date.now() - started;
        entry.detail = detail ? detail(result) : undefined;
        await persist("provisioning");
        return result;
      } catch (error) {
        entry.status = "error";
        entry.durationMs = Date.now() - started;
        if (error instanceof FlyApiError) {
          entry.detail = describeFlyError(error);
          entry.httpStatus = error.status;
          entry.raw = error.body.slice(0, 4000);
        } else {
          entry.detail = error instanceof Error ? error.message : String(error);
          entry.raw = error instanceof Error ? (error.stack ?? undefined) : undefined;
        }
        await persist("provisioning");
        throw error;
      }
    };

    try {
      await runStep(
        "Create Fly app",
        "POST /apps",
        () =>
          fly(`/apps`, {
            method: "POST",
            body: JSON.stringify({ app_name: data.appName, org_slug: data.orgSlug }),
          }),
        () => data.appName,
      );

      const volume = await runStep(
        "Create Postgres volume",
        `POST /apps/${data.appName}/volumes`,
        () =>
          fly(`/apps/${data.appName}/volumes`, {
            method: "POST",
            body: JSON.stringify({ name: "pgdata", region: data.region, size_gb: 3 }),
          }),
        () => `3 GB in ${data.region}`,
      );

      const pgMachine = await runStep(
        "Start Postgres machine",
        `POST /apps/${data.appName}/machines`,
        () => {
          const pgConfig = postgresMachineConfig(data.region, password);
          pgConfig.config.mounts = [{ volume: volume.id, path: "/var/lib/postgresql/data" }];
          return fly(`/apps/${data.appName}/machines`, {
            method: "POST",
            body: JSON.stringify(pgConfig),
          });
        },
        () => pgHost,
      );
      if (pgMachine?.private_ip) pgHost = `[${pgMachine.private_ip}]`;

      // Postgres has to finish initdb (it creates the four databases on first
      // boot) before the node and the agent can migrate their schemas.
      let pgWaitDetail = "database accepting connections";
      await runStep(
        "Wait for Postgres to start",
        `GET /apps/${data.appName}/machines/${pgMachine?.id}/wait`,
        async () => {
          await waitForMachineState(
            data.appName,
            pgMachine.id,
            "started",
            180,
            (attempt: number, elapsed: number) => {
              pgWaitDetail = `waiting for boot (attempt ${attempt}, ${elapsed}s elapsed)`;
            },

          );
          await new Promise((r) => setTimeout(r, 8000));
          pgWaitDetail = "database accepting connections";
          return true;
        },
        () => pgWaitDetail,
      );


      const prismMachine = await runStep(
        "Start PRISM node",
        `POST /apps/${data.appName}/machines`,
        () =>
          fly(`/apps/${data.appName}/machines`, {
            method: "POST",
            body: JSON.stringify(prismNodeMachineConfig(data.region, pgHost, password)),
          }),
        () => prismHost,
      );
      if (prismMachine?.private_ip) prismHost = `[${prismMachine.private_ip}]`;

      await runStep(
        "Start Identus Cloud Agent",
        `POST /apps/${data.appName}/machines`,
        () =>
          fly(`/apps/${data.appName}/machines`, {
            method: "POST",
            body: JSON.stringify(
              agentMachineConfig(
                data.region,
                pgHost,
                prismHost,
                password,
                adminKey,
                data.appName,
                guest,
              ),
            ),
          }),
        () => `${data.appName}.fly.dev`,
      );

      // A missing public IP is recoverable — log it and keep going.
      try {
        await runStep("Allocate public IPs", "GraphQL allocateIpAddress", () =>
          allocateSharedIpv4(data.appName),
        );
      } catch {
        /* already recorded as an error step */
      }

      await persist("ready");
      // The machines are created but the agent still needs to boot; the client polls
      // awaitAgentReady until the readiness state flips to ready or times out.
      await context.supabase
        .from("agent_connections")
        .update({
          readiness_status: "waiting",
          readiness_attempts: 0,
          readiness_started_at: new Date().toISOString(),
          ready_at: null,
        })
        .eq("id", conn.id);
      await logActivity(
        context.supabase,
        context.userId,
        conn.id,
        "fly.provisioned",
        `Provisioned Fly app ${data.appName}`,
      );
      return {
        ok: true as const,
        connectionId: conn.id as string,
        steps,
        adminKey,
        baseUrl: `https://${data.appName}.fly.dev`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      steps.push({
        step: "Provisioning failed",
        status: "error",
        detail: message,
        at: new Date().toISOString(),
      });
      await persist("failed");
      await logActivity(
        context.supabase,
        context.userId,
        conn.id,
        "fly.failed",
        message,
        "error",
      );
      return { ok: false as const, connectionId: conn.id as string, steps, message };
    }
  });

/** Live provisioning log for one connection, plus current Fly machine states. */
export const getProvisionLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), includeMachines: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("id, fly_app_name, provision_status, provision_log")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const steps = Array.isArray(conn.provision_log)
      ? (conn.provision_log as unknown as import("./types").ProvisionStep[])
      : [];

    let machines: { id: string; name: string; state: string; region: string }[] = [];
    let machinesMessage = "";
    if (data.includeMachines !== false && conn.fly_app_name) {
      try {
        const { listMachines } = await import("./fly.server");
        machines = await listMachines(conn.fly_app_name);
      } catch (flyError) {
        machinesMessage = flyError instanceof Error ? flyError.message : String(flyError);
      }
    }

    return {
      status: (conn.provision_status ?? "unknown") as string,
      appName: conn.fly_app_name as string | null,
      steps,
      machines,
      machinesMessage,
    };
  });


export const flyAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { fly } = await import("./fly.server");
    const { checkHealth } = await import("./agent.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (!conn.fly_app_name) throw new Error("This connection is not a Fly.io deployment.");

    let machines: { id: string; name: string; state: string; region: string }[] = [];
    let message = "";
    try {
      const raw = (await fly(`/apps/${conn.fly_app_name}/machines`)) as any[];
      machines = (raw ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        state: m.state,
        region: m.region,
      }));
    } catch (flyError) {
      message = flyError instanceof Error ? flyError.message : String(flyError);
    }
    const health = await checkHealth(conn);
    await context.supabase
      .from("agent_connections")
      .update({
        last_health: health.healthy ? "healthy" : "unreachable",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { machines, health, message };
  });

/**
 * Machine state, Fly health-check output and event history (exit codes, OOM
 * kills) for a Fly deployment, plus a plain-language diagnosis per machine.
 */
export const flyMachineDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getAppDiagnostics, listIpAddresses } = await import("./fly.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("id, fly_app_name")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    if (!conn.fly_app_name) throw new Error("This connection is not a Fly.io deployment.");
    try {
      const machines = await getAppDiagnostics(conn.fly_app_name);
      // No public IP means <app>.fly.dev has no DNS record at all, so every probe
      // fails with a transport error no matter how healthy the container is.
      let ips: { address: string; type: string }[] = [];
      let ipsMessage = "";
      try {
        ips = await listIpAddresses(conn.fly_app_name);
      } catch (ipError) {
        ipsMessage = ipError instanceof Error ? ipError.message : String(ipError);
      }
      return {
        ok: true as const,
        appName: conn.fly_app_name,
        machines,
        ips,
        ipsMessage,
        message: "",
        fatal: machines.some((m) => m.fatal),
      };
    } catch (flyError) {
      return {
        ok: false as const,
        appName: conn.fly_app_name,
        machines: [] as Awaited<ReturnType<typeof getAppDiagnostics>>,
        ips: [] as { address: string; type: string }[],
        ipsMessage: "",
        message: flyError instanceof Error ? flyError.message : String(flyError),
        fatal: false,
      };
    }
  });

/**
 * Repairs an app that has no public IP. Without one Fly never publishes
 * `<app>.fly.dev`, so the agent is unreachable even when all machines are up.
 */
export const flyAllocateIps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { allocateSharedIpv4 } = await import("./fly.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("id, fly_app_name")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    if (!conn.fly_app_name) throw new Error("This connection is not a Fly.io deployment.");
    try {
      const ips = await allocateSharedIpv4(conn.fly_app_name);
      return {
        ok: true as const,
        ips,
        message: `${conn.fly_app_name}.fly.dev now resolves via ${ips
          .map((i) => `${i.type} ${i.address}`)
          .join(", ")}. DNS can take up to a minute to propagate.`,
      };
    } catch (flyError) {
      return {
        ok: false as const,
        ips: [] as { address: string; type: string }[],
        message: flyError instanceof Error ? flyError.message : String(flyError),
      };
    }
  });

/**
 * Container log tail for the deployed Cloud Agent. This is the signal machine
 * state and health checks cannot give you: whether the JVM crashed, is still
 * migrating, or never reached its database.
 */
export const flyAgentLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), machineId: z.string().trim().min(1).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getAgentLogs } = await import("./fly.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("id, fly_app_name")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    if (!conn.fly_app_name) throw new Error("This connection is not a Fly.io deployment.");
    try {
      const report = await getAgentLogs(conn.fly_app_name, data.machineId ?? null);
      return { ok: true as const, ...report, message: "" };
    } catch (flyError) {
      return {
        ok: false as const,
        appName: conn.fly_app_name,
        machineId: null,
        lines: [] as Awaited<ReturnType<typeof getAgentLogs>>["lines"],
        diagnosis: "",
        fatal: false,
        message: flyError instanceof Error ? flyError.message : String(flyError),
      };
    }
  });


/**
 * Deletes a Fly app by name so half-created deployments from failed attempts can
 * be cleaned up even when no connection row tracks them. The app must belong to
 * an organisation the saved Fly token can see.
 */
export const destroyFlyAppByName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appName: z.string().trim().regex(/^[a-z0-9-]{4,40}$/),
        orgSlug: z.string().trim().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { fly, listApps } = await import("./fly.server");
    const { logActivity } = await import("./agent.server");
    const apps = await listApps(data.orgSlug);
    if (!apps.some((a) => a.name === data.appName)) {
      throw new Error(`${data.appName} is not an app in ${data.orgSlug}.`);
    }
    await fly(`/apps/${data.appName}`, { method: "DELETE" });
    await context.supabase
      .from("agent_connections")
      .delete()
      .eq("user_id", context.userId)
      .eq("fly_app_name", data.appName);
    await logActivity(
      context.supabase,
      context.userId,
      null,
      "fly.destroyed",
      `Destroyed Fly app ${data.appName}`,
    );
    return { ok: true as const };
  });

export const destroyFlyApp = createServerFn({ method: "POST" })


  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { fly } = await import("./fly.server");
    const { logActivity } = await import("./agent.server");
    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (!conn.fly_app_name) throw new Error("This connection is not a Fly.io deployment.");
    await fly(`/apps/${conn.fly_app_name}`, { method: "DELETE" });
    await context.supabase.from("agent_connections").delete().eq("id", data.id);
    await logActivity(
      context.supabase,
      context.userId,
      null,
      "fly.destroyed",
      `Destroyed Fly app ${conn.fly_app_name}`,
    );
    return { ok: true };
  });

/**
 * Apps in a Fly organisation, annotated with whether the console already tracks
 * them so the picker can offer a single "Use this agent" action.
 */
export const flyApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgSlug: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { listApps } = await import("./fly.server");
    const { data: rows } = await context.supabase
      .from("agent_connections")
      .select("id, fly_app_name, api_key, is_active")
      .eq("user_id", context.userId)
      .eq("mode", "fly");
    const tracked = new Map(
      (rows ?? [])
        .filter((r: any) => r.fly_app_name)
        .map((r: any) => [r.fly_app_name as string, r]),
    );
    try {
      const apps = await listApps(data.orgSlug);
      return {
        ok: true as const,
        message: "",
        apps: apps.map((app) => {
          const row = tracked.get(app.name);
          return {
            name: app.name,
            status: app.status,
            machineCount: app.machineCount,
            machines: app.machines,
            connectionId: (row?.id as string | undefined) ?? null,
            hasKey: Boolean(row?.api_key),
            isActive: Boolean(row?.is_active),
          };
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        apps: [] as {
          name: string;
          status: string;
          machineCount: number;
          machines: { id: string; name: string; state: string; region: string }[];
          connectionId: string | null;
          hasKey: boolean;
          isActive: boolean;
        }[],
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

/**
 * One-click: write the Fly app's URL + admin key into the console config and
 * make it the active agent. Re-syncs an existing row instead of duplicating.
 */
export const adoptFlyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appName: z.string().trim().regex(/^[a-z0-9-]{2,63}$/),
        region: z.string().trim().min(2).optional(),
        adminKey: z.string().trim().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { probeAgent, logActivity } = await import("./agent.server");
    const baseUrl = `https://${data.appName}.fly.dev`;

    const { data: existing } = await context.supabase
      .from("agent_connections")
      .select("id, api_key")
      .eq("user_id", context.userId)
      .eq("fly_app_name", data.appName)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      name: `Fly · ${data.appName}`,
      mode: "fly",
      base_url: baseUrl,
      fly_app_name: data.appName,
      provision_status: "adopted",
    };
    if (data.region) patch["fly_region"] = data.region;
    if (data.adminKey) patch["api_key"] = data.adminKey;

    let id: string;
    if (existing?.id) {
      const { error } = await context.supabase
        .from("agent_connections")
        .update(patch as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      id = existing.id as string;
    } else {
      const { data: row, error } = await context.supabase
        .from("agent_connections")
        .insert({ ...patch, user_id: context.userId } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row.id as string;
    }

    const apiKey = data.adminKey ?? ((existing?.api_key as string | null) ?? null);
    const probe = await probeAgent({
      mode: "fly",
      base_url: baseUrl,
      fly_app_name: data.appName,
      api_key: apiKey,
    });

    await context.supabase
      .from("agent_connections")
      .update({
        last_probe: probe as unknown as never,
        last_health: probe.healthy ? "healthy" : "unreachable",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", id);

    await context.supabase
      .from("agent_connections")
      .update({ is_active: false })
      .eq("user_id", context.userId);
    const { error: activateError } = await context.supabase
      .from("agent_connections")
      .update({ is_active: true })
      .eq("id", id);
    if (activateError) throw new Error(activateError.message);

    await logActivity(
      context.supabase,
      context.userId,
      id,
      "connection.adopted",
      `Using Fly agent ${data.appName} (${probe.healthy ? "healthy" : "unreachable"})`,
    );

    return { id, baseUrl, healthy: probe.healthy, message: probe.message };
  });

/**
 * Mints a new admin API key, pushes it into the deployed agent machine's env,
 * waits for the restart and verifies the agent answers with the new key.
 * Rolls the machine and the stored key back if verification fails.
 */
export const rotateFlyAdminKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const {
      fly,
      FlyApiError,
      describeFlyError,
      listMachines,
      updateMachineEnv,
      waitForMachineState,
    } = await import("./fly.server");
    type Step = import("./fly.server").Step;
    const { probeAgent, logActivity } = await import("./agent.server");

    const { data: conn, error } = await context.supabase
      .from("agent_connections")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    if (conn.mode !== "fly" || !conn.fly_app_name) {
      throw new Error("Only Fly.io deployments can rotate their admin credentials.");
    }

    const appName = conn.fly_app_name as string;
    const previousKey = (conn.api_key as string | null) ?? null;
    const newKey = crypto.randomUUID().replace(/-/g, "");
    const steps: Step[] = [];

    const persist = async (status: string) => {
      await context.supabase
        .from("agent_connections")
        .update({ provision_status: status, provision_log: steps as unknown as never })
        .eq("id", data.id);
    };

    const runStep = async <T>(
      name: string,
      endpoint: string,
      fn: () => Promise<T>,
      detail?: (result: T) => string | undefined,
    ): Promise<T> => {
      const entry: Step = {
        step: name,
        status: "running",
        at: new Date().toISOString(),
        endpoint,
      };
      steps.push(entry);
      await persist("rotating");
      const started = Date.now();
      try {
        const result = await fn();
        entry.status = "ok";
        entry.durationMs = Date.now() - started;
        entry.detail = detail ? detail(result) : undefined;
        await persist("rotating");
        return result;
      } catch (stepError) {
        entry.status = "error";
        entry.durationMs = Date.now() - started;
        if (stepError instanceof FlyApiError) {
          entry.detail = describeFlyError(stepError);
          entry.httpStatus = stepError.status;
          entry.raw = stepError.body.slice(0, 4000);
        } else {
          entry.detail = stepError instanceof Error ? stepError.message : String(stepError);
        }
        await persist("rotate_failed");
        throw stepError;
      }
    };

    const failStep = async (name: string, detail: string) => {
      steps.push({ step: name, status: "error", at: new Date().toISOString(), detail });
      await persist("rotate_failed");
    };

    try {
      const machines = await runStep(
        "Locate agent machine",
        `GET /apps/${appName}/machines`,
        () => listMachines(appName),
        (list) => `${list.length} machines`,
      );
      const agentMachine =
        machines.find((m) => m.name === "identus-cloud-agent") ?? machines[0];
      if (!agentMachine) throw new Error("No Cloud Agent machine found in this Fly app.");

      await runStep("Mint new admin key", "local", async () => newKey, () => "32-char key generated");

      await runStep(
        "Update machine configuration",
        `POST /apps/${appName}/machines/${agentMachine.id}`,
        () =>
          updateMachineEnv(appName, agentMachine.id, {
            ADMIN_TOKEN: newKey,
            DEFAULT_WALLET_AUTH_API_KEY: newKey,
          }),
        () => `${agentMachine.name} restarting`,
      );

      await runStep(
        "Wait for machine to start",
        `GET /apps/${appName}/machines/${agentMachine.id}/wait`,
        () => waitForMachineState(appName, agentMachine.id, "started", 180),
        () => "machine started",
      );

      // The agent needs a moment after `started` before the HTTP API answers.
      const probe = await runStep(
        "Verify with the new key",
        `${conn.base_url}/_system/health`,
        async () => {
          let last = await probeAgent({
            mode: "fly",
            base_url: conn.base_url,
            fly_app_name: appName,
            api_key: newKey,
          });
          for (let attempt = 0; attempt < 5 && !last.healthy; attempt += 1) {
            await new Promise((r) => setTimeout(r, 5000));
            last = await probeAgent({
              mode: "fly",
              base_url: conn.base_url,
              fly_app_name: appName,
              api_key: newKey,
            });
          }
          return last;
        },
        (result) => result.message,
      );

      if (!probe.healthy) {
        // Restore the previous key so the console and the agent never diverge.
        if (previousKey) {
          try {
            await updateMachineEnv(appName, agentMachine.id, {
              ADMIN_TOKEN: previousKey,
              DEFAULT_WALLET_AUTH_API_KEY: previousKey,
            });
            await failStep(
              "Rolled back to previous key",
              "The agent did not accept the new key — the machine was restored with the old credentials.",
            );
          } catch (rollbackError) {
            await failStep(
              "Rollback failed",
              rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            );
          }
        } else {
          await failStep(
            "Verification failed",
            "The agent did not answer with the new key and there was no previous key to restore.",
          );
        }
        await logActivity(
          context.supabase,
          context.userId,
          data.id,
          "connection.key_rotation_failed",
          `Admin key rotation for ${appName} failed verification`,
        );
        return {
          ok: false as const,
          apiKey: null as string | null,
          message: probe.message || "The agent did not accept the new admin key.",
        };
      }

      await context.supabase
        .from("agent_connections")
        .update({
          api_key: newKey,
          last_probe: probe as unknown as never,
          last_health: "healthy",
          last_checked_at: new Date().toISOString(),
          readiness_status: "ready",
          ready_at: new Date().toISOString(),
          provision_status: "ready",
        })
        .eq("id", data.id);

      await logActivity(
        context.supabase,
        context.userId,
        data.id,
        "connection.key_rotated",
        `Rotated admin credentials for ${appName}`,
      );

      return { ok: true as const, apiKey: newKey, message: probe.message };
    } catch (rotateError) {
      const message = rotateError instanceof Error ? rotateError.message : String(rotateError);
      await logActivity(
        context.supabase,
        context.userId,
        data.id,
        "connection.key_rotation_failed",
        message,
      );
      return { ok: false as const, apiKey: null as string | null, message };
    }
  });
