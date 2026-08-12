import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Turn opaque Fly registry failures into something actionable in the log. */
function describeFlyError(error: FlyApiError) {
  const manifest = /failed to get manifest ([^\s"]+)/.exec(error.body);
  if (manifest) {
    return `Image ${manifest[1]} is not publicly pullable — Fly could not fetch its manifest`;
  }
  if (/unauthorized|denied/i.test(error.body) && error.status < 500) {
    return `Fly API ${error.status} — registry or token rejected the request`;
  }
  return `Fly API ${error.status}`;
}

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
      allocateSharedIpv4,
      postgresMachineConfig,
      prismNodeMachineConfig,
      agentMachineConfig,
    } = await import("./fly.server");
    type Step = import("./fly.server").Step;
    const { logActivity } = await import("./agent.server");

    const steps: Step[] = [];
    const password = data.pgPassword ?? crypto.randomUUID().replace(/-/g, "");
    const adminKey = data.adminKey ?? crypto.randomUUID().replace(/-/g, "");
    const guest = { cpus: data.cpus ?? 2, memoryMb: data.memoryMb ?? 2048 };
    const pgHost = `identus-postgres.process.${data.appName}.internal`;
    const prismHost = `identus-prism-node.process.${data.appName}.internal`;

    const { data: conn, error: insertError } = await context.supabase
      .from("agent_connections")
      .insert({
        user_id: context.userId,
        name: `Fly · ${data.appName}`,
        mode: "fly",
        base_url: `https://${data.appName}.fly.dev/cloud-agent`,
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

      await runStep(
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

      await runStep(
        "Start PRISM node",
        `POST /apps/${data.appName}/machines`,
        () =>
          fly(`/apps/${data.appName}/machines`, {
            method: "POST",
            body: JSON.stringify(prismNodeMachineConfig(data.region, pgHost, password)),
          }),
        () => prismHost,
      );

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
        baseUrl: `https://${data.appName}.fly.dev/cloud-agent`,
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
