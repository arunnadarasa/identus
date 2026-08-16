import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { STARTER_SNIPPETS } from "./snippets";
import type { ProvisionStep } from "@/lib/identus/types";

function spriteNameFor(userId: string) {
  return `identus-sdk-${userId.replace(/-/g, "").slice(0, 16)}`;
}

interface AgentBinding {
  mode: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

async function resolveAgent(supabase: any, userId: string): Promise<AgentBinding | null> {
  const { data } = await supabase
    .from("agent_connections")
    .select("name, mode, base_url, fly_app_name, api_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const { agentBaseUrl } = await import("@/lib/identus/agent.server");
  return {
    mode: data.mode as string,
    name: data.name as string,
    baseUrl: agentBaseUrl(data as any),
    apiKey: (data.api_key as string | null) ?? "",
  };
}

/** Current box, saved snippets and which agent snippets will talk to. */
export const getSandbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: box }, { data: snippets }] = await Promise.all([
      context.supabase
        .from("sprite_boxes")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("sprite_snippets")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true }),
    ]);

    const agent = await resolveAgent(context.supabase, context.userId);
    const hasToken = Boolean(process.env["SPRITES_TOKEN"]);

    return {
      hasToken,
      box: box
        ? {
            id: box.id as string,
            spriteName: box.sprite_name as string,
            url: (box.url as string | null) ?? null,
            status: box.status as string,
            sdkReady: Boolean(box.sdk_ready),
            steps: (Array.isArray(box.provision_log)
              ? box.provision_log
              : []) as unknown as ProvisionStep[],
            updatedAt: box.updated_at as string,
          }
        : null,
      snippets: (snippets ?? []).map((s: any) => {
        const starter = STARTER_SNIPPETS.find((t) => t.name === s.name) ?? null;
        // A starter is stale when its saved body differs from the current
        // template — either it predates the version stamp or the template moved on.
        const stale = Boolean(starter) && (s.code as string) !== starter!.code;
        return {
          id: s.id as string,
          name: s.name as string,
          code: s.code as string,
          lastOutput: (s.last_output as string | null) ?? null,
          lastExitCode: (s.last_exit_code as number | null) ?? null,
          lastRunAt: (s.last_run_at as string | null) ?? null,
          templateVersion: (s.template_version as string | null) ?? null,
          starterVersion: starter?.version ?? null,
          isStarter: Boolean(starter),
          stale,
        };
      }),
      agent,
      suggestedName: spriteNameFor(context.userId),
    };
  });


/** Creates the sprite if needed, lays down the workspace and installs the SDK. */
export const ensureSandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reinstall: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sprites = await import("./sprites.server");
    const workspace = await import("./workspace.server");

    const name = spriteNameFor(context.userId);
    const steps: ProvisionStep[] = [];
    let url: string | null = null;

    const persist = async (status: string, sdkReady?: boolean) => {
      await context.supabase.from("sprite_boxes").upsert(
        {
          user_id: context.userId,
          sprite_name: name,
          url,
          status,
          provision_log: steps as unknown as any,
          ...(sdkReady === undefined ? {} : { sdk_ready: sdkReady }),
        },
        { onConflict: "user_id" },
      );
    };

    const run = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      const started = Date.now();
      const entry: ProvisionStep = { step: label, status: "running", at: new Date().toISOString() };
      steps.push(entry);
      await persist("provisioning");
      try {
        const result = await fn();
        entry.status = "ok";
        entry.durationMs = Date.now() - started;
        await persist("provisioning");
        return result;
      } catch (error) {
        entry.status = "error";
        entry.durationMs = Date.now() - started;
        entry.detail = error instanceof Error ? error.message : String(error);
        if (
          error instanceof Error &&
          "raw" in error &&
          typeof (error as Error & { raw?: unknown }).raw === "string"
        ) {
          entry.raw = (error as Error & { raw: string }).raw.slice(-12000);
        }
        if (error instanceof sprites.SpritesApiError) {
          entry.endpoint = error.endpoint;
          entry.httpStatus = error.status;
          entry.raw = error.raw.slice(0, 2000);
        }
        if (error instanceof sprites.SpritesTimeoutError) {
          entry.endpoint = error.endpoint;
          entry.httpStatus = 408;
        }
        await persist("error");
        throw error;
      }
    };

    try {
      const existing = await run("Look up sandbox", () => sprites.getSprite(name));
      if (existing) {
        url = existing.url;
        steps[steps.length - 1]!.detail = `Found ${name} (${existing.status})`;
      } else {
        const created = await run("Create sandbox", () => sprites.createSprite(name));
        url = created.url;
      }

      await run("Write workspace files", async () => {
        for (const file of workspace.workspaceFiles()) {
          await sprites.writeFile(name, file.path, file.content);
        }
        return true;
      });

      const node = await run("Check Node runtime", async () => {
        const result = await sprites.exec(name, workspace.NODE_BOOTSTRAP);
        return result.stdout.trim().split("\n").slice(-1)[0] ?? "";
      });
      steps[steps.length - 1]!.detail = `node ${node}`;

      const install = await run("Install Identus TypeScript SDK", async () => {
        const result = await sprites.exec(
          name,
          data.reinstall ? workspace.INSTALL_SDK_CLEAN : workspace.INSTALL_SDK,
          sprites.TIMEOUTS.install,
        );
        return result;
      });
      const sdkLine = install.stdout.match(/SDK_PACKAGE=(\S+)/)?.[1] ?? "";
      steps[steps.length - 1]!.detail = sdkLine ? `using ${sdkLine}` : "SDK install finished";
      steps[steps.length - 1]!.raw = install.stdout.slice(-12000);

      let sdkVersion = "";
      if (sdkLine) {
        const verify = await run("Verify SDK loads", async () => {
          const result = await sprites.exec(name, workspace.VERIFY_SDK);
          const version = result.stdout.match(/SDK_VERSION=(\S+)/)?.[1] ?? "";
          if (result.exitCode !== 0 || !version) {
            const output = result.stdout.trim() || "no output";
            const cause = output.match(/(?:Error:\s*)?Cannot find module ['\"]([^'\"]+)/)?.[1];
            throw Object.assign(
              new Error(
                cause
                  ? `The SDK could not resolve ${cause}. Run Repair box to rebuild its dependencies.`
                  : "The SDK failed its import probe. See the verification output below.",
              ),
              { raw: output },
            );
          }
          return { version, raw: result.stdout };
        });
        sdkVersion = verify.version;
        const nodeVersion = verify.raw.match(/NODE_VERSION=(\S+)/)?.[1] ?? "Node 20";
        const rxdbVersion = verify.raw.match(/RXDB_VERSION=(\S+)/)?.[1] ?? "14.17.1";
        steps[steps.length - 1]!.detail =
          `SDK ${sdkVersion} imports cleanly with rxdb ${rxdbVersion} on ${nodeVersion}`;
        steps[steps.length - 1]!.raw = verify.raw.slice(-4000);
      }

      const service = await run("Register keepalive service", () =>
        sprites.putService(name, sprites.SPRITE_SERVICE, {
          cmd: "python3",
          args: ["-m", "http.server", "8080"],
          dir: sprites.SPRITE_DIR,
          http_port: 8080,
        }),
      );
      steps[steps.length - 1]!.detail = service.changed
        ? "definition written"
        : "already registered — reused the running definition";

      if (service.changed) {
        await run("Start service", () => sprites.startService(name, sprites.SPRITE_SERVICE));
      }

      if (!url) {
        const info = await run("Read public URL", () => sprites.getSprite(name));
        url = info?.url ?? null;
      }

      if (url) {
        const warmed = await run("Warm sandbox", () => sprites.warmUrl(url!));
        steps[steps.length - 1]!.detail = warmed ? "responding" : "still cold, will wake on demand";
      }

      // Seed starter snippets once.
      const { count } = await context.supabase
        .from("sprite_snippets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId);
      if (!count) {
        await context.supabase.from("sprite_snippets").insert(
          STARTER_SNIPPETS.map((s) => ({
            user_id: context.userId,
            name: s.name,
            code: s.code,
          })),
        );
      }

      await persist("ready", Boolean(sdkLine && sdkVersion));
      const { logActivity } = await import("@/lib/identus/agent.server");
      await logActivity(
        context.supabase,
        context.userId,
        null,
        "sandbox.ready",
        `SDK sandbox ${name} ready`,
      );
      return { ok: true as const, name, url, steps, sdkVersion, message: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await persist("failed");
      return { ok: false as const, name, url, steps, sdkVersion: "", message };
    }
  });

/** Saves a snippet, runs it inside the box and stores the output. */
export const runSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        code: z.string().max(200_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sprites = await import("./sprites.server");
    const workspace = await import("./workspace.server");

    const { data: box } = await context.supabase
      .from("sprite_boxes")
      .select("sprite_name, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!box) {
      return {
        ok: false as const,
        output: "",
        exitCode: null as number | null,
        durationMs: 0,
        snippetId: null as string | null,
        message: "Create your sandbox first.",
      };
    }

    // Persist the snippet before running so nothing is lost on a failed run.
    let snippetId = data.id ?? null;
    if (snippetId) {
      await context.supabase
        .from("sprite_snippets")
        .update({ name: data.name, code: data.code })
        .eq("id", snippetId)
        .eq("user_id", context.userId);
    } else {
      const { data: inserted } = await context.supabase
        .from("sprite_snippets")
        .insert({ user_id: context.userId, name: data.name, code: data.code })
        .select("id")
        .single();
      snippetId = (inserted?.id as string) ?? null;
    }

    const agent = await resolveAgent(context.supabase, context.userId);
    if (agent && agent.mode === "simulated") {
      const message =
        "Your active agent is in simulated mode, which has no REST endpoint. Snippets still run, but AGENT_BASE_URL is empty — switch to a Docker local or Fly.io agent to call the API.";
      const result = await runInBox(sprites, workspace, box.sprite_name as string, data.code, {
        AGENT_BASE_URL: "",
        AGENT_API_KEY: "",
      });
      await saveRun(context, snippetId, result);
      return { ok: result.exitCode === 0, ...result, snippetId, message };
    }

    const result = await runInBox(sprites, workspace, box.sprite_name as string, data.code, {
      AGENT_BASE_URL: agent?.baseUrl ?? "",
      AGENT_API_KEY: agent?.apiKey ?? "",
    });
    await saveRun(context, snippetId, result);
    return { ok: result.exitCode === 0, ...result, snippetId, message: "" };
  });

async function runInBox(
  sprites: typeof import("./sprites.server"),
  workspace: typeof import("./workspace.server"),
  name: string,
  code: string,
  env: Record<string, string>,
) {
  const started = Date.now();
  try {
    await sprites.writeFile(name, `${sprites.SPRITE_DIR}/snippets/run.mjs`, code);
    const script = `${sprites.envExport(env)}; ${workspace.RUN_SNIPPET}`;
    const result = await sprites.exec(name, script);
    return {
      output: result.stdout.slice(-60_000),
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      output: error instanceof Error ? error.message : String(error),
      exitCode: null as number | null,
      durationMs: Date.now() - started,
    };
  }
}

async function saveRun(
  context: { supabase: any; userId: string },
  snippetId: string | null,
  result: { output: string; exitCode: number | null },
) {
  if (!snippetId) return;
  await context.supabase
    .from("sprite_snippets")
    .update({
      last_output: result.output,
      last_exit_code: result.exitCode,
      last_run_at: new Date().toISOString(),
    })
    .eq("id", snippetId)
    .eq("user_id", context.userId);
}

export const saveSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        code: z.string().max(200_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      await context.supabase
        .from("sprite_snippets")
        .update({ name: data.name, code: data.code })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      return { ok: true as const, id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("sprite_snippets")
      .insert({ user_id: context.userId, name: data.name, code: data.code })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted.id as string };
  });

export const deleteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("sprite_snippets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true as const };
  });

/**
 * Rewrite the starter set from the current templates. Matches by name so a fixed
 * starter replaces the stale copy seeded at box creation; snippets the user named
 * themselves are left alone.
 */
export const resetStarterSnippets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("sprite_snippets")
      .select("id, name")
      .eq("user_id", context.userId);

    const byName = new Map<string, string>(
      (existing ?? []).map((row: any) => [row.name as string, row.id as string]),
    );

    let updated = 0;
    let inserted = 0;
    for (const snippet of STARTER_SNIPPETS) {
      const id = byName.get(snippet.name);
      if (id) {
        await context.supabase
          .from("sprite_snippets")
          .update({ code: snippet.code })
          .eq("id", id)
          .eq("user_id", context.userId);
        updated += 1;
      } else {
        await context.supabase
          .from("sprite_snippets")
          .insert({ user_id: context.userId, name: snippet.name, code: snippet.code });
        inserted += 1;
      }
    }

    return { ok: true as const, updated, inserted };
  });

export const destroySandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sprites = await import("./sprites.server");
    const { data: box } = await context.supabase
      .from("sprite_boxes")
      .select("sprite_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!box) return { ok: true as const, message: "" };
    try {
      await sprites.deleteSprite(box.sprite_name as string);
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    await context.supabase.from("sprite_boxes").delete().eq("user_id", context.userId);
    return { ok: true as const, message: "" };
  });
