import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ProvisionStep } from "@/lib/identus/types";

const FILE_NAMES = ["docker-compose.yml", ".env", "postgres/init.sql"] as const;

function spriteNameFor(userId: string) {
  return `identus-sdk-${userId.replace(/-/g, "").slice(0, 16)}`;
}

export interface ComposeIssueReport {
  errors: string[];
  warnings: string[];
  resolved: string;
}

/** Lab state: files, last validation result and whether the toolkit is installed. */
export const getComposeLab = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: box }, { data: files }] = await Promise.all([
      context.supabase
        .from("sprite_boxes")
        .select("sprite_name, status, lab_ready, lab_log")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("compose_files")
        .select("id, name, content, last_result, last_validated_at")
        .eq("user_id", context.userId)
        .order("name", { ascending: true }),
    ]);

    const { runCommands } = await import("./compose.server");

    return {
      hasToken: Boolean(process.env["SPRITES_TOKEN"]),
      spriteName: (box?.sprite_name as string | undefined) ?? spriteNameFor(context.userId),
      boxStatus: (box?.status as string | undefined) ?? null,
      labReady: Boolean((box as any)?.lab_ready),
      labSteps: (Array.isArray((box as any)?.lab_log)
        ? (box as any).lab_log
        : []) as unknown as ProvisionStep[],
      files: (files ?? []).map((f: any) => ({
        id: f.id as string,
        name: f.name as string,
        content: f.content as string,
        lastResult: (f.last_result as ComposeIssueReport | null) ?? null,
        lastValidatedAt: (f.last_validated_at as string | null) ?? null,
      })),
      runCommands: runCommands(),
    };
  });

/** One click: create/reuse the sprite, install python+PyYAML, seed the bundle. */
export const ensureComposeLab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reset: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sprites = await import("./sprites.server");
    const lab = await import("./compose.server");

    const name = spriteNameFor(context.userId);
    const steps: ProvisionStep[] = [];
    let url: string | null = null;

    const persist = async (status: string, labReady?: boolean) => {
      await context.supabase.from("sprite_boxes").upsert(
        {
          user_id: context.userId,
          sprite_name: name,
          url,
          status,
          lab_log: steps as unknown as any,
          ...(labReady === undefined ? {} : { lab_ready: labReady }),
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
        if (error instanceof sprites.SpritesApiError) {
          entry.endpoint = error.endpoint;
          entry.httpStatus = error.status;
          entry.raw = error.raw.slice(0, 2000);
        }
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

      const tools = await run("Install compose toolkit (python3 + PyYAML)", async () => {
        const result = await sprites.exec(name, lab.LAB_BOOTSTRAP);
        return result.stdout.trim();
      });
      steps[steps.length - 1]!.detail = tools.split("\n").slice(-2).join(" · ");
      steps[steps.length - 1]!.raw = tools.slice(-2000);

      // Seed or reset the saved bundle in the database.
      const { data: rows } = await context.supabase
        .from("compose_files")
        .select("id, name, content")
        .eq("user_id", context.userId);
      const existingNames = new Set((rows ?? []).map((r: any) => r.name as string));

      await run(data.reset ? "Reset bundle to defaults" : "Seed compose bundle", async () => {
        for (const file of lab.defaultBundle()) {
          if (data.reset || !existingNames.has(file.name)) {
            await context.supabase.from("compose_files").upsert(
              { user_id: context.userId, name: file.name, content: file.content },
              { onConflict: "user_id,name" },
            );
          }
        }
        return true;
      });

      const { data: current } = await context.supabase
        .from("compose_files")
        .select("name, content")
        .eq("user_id", context.userId);

      await run("Write bundle into the sandbox", async () => {
        await sprites.writeFile(name, `${lab.LAB_DIR}/validate.py`, lab.VALIDATOR);
        for (const file of current ?? []) {
          await sprites.writeFile(
            name,
            `${lab.LAB_DIR}/${file.name as string}`,
            file.content as string,
          );
        }
        return true;
      });

      await persist("ready", true);
      const { logActivity } = await import("@/lib/identus/agent.server");
      await logActivity(
        context.supabase,
        context.userId,
        null,
        "sandbox.compose-lab",
        `Compose lab ready in ${name}`,
      );
      return { ok: true as const, name, steps, message: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await persist("failed");
      return { ok: false as const, name, steps, message };
    }
  });

export const saveComposeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.enum(FILE_NAMES),
        content: z.string().max(200_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("compose_files").upsert(
      { user_id: context.userId, name: data.name, content: data.content },
      { onConflict: "user_id,name" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Pushes the saved bundle into the sprite and runs the validator. */
export const validateCompose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sprites = await import("./sprites.server");
    const lab = await import("./compose.server");

    const { data: box } = await context.supabase
      .from("sprite_boxes")
      .select("sprite_name, lab_ready")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!box) {
      return {
        ok: false as const,
        report: null as ComposeIssueReport | null,
        raw: "",
        message: "Create the compose lab first.",
      };
    }

    const name = box.sprite_name as string;
    const { data: files } = await context.supabase
      .from("compose_files")
      .select("name, content")
      .eq("user_id", context.userId);

    try {
      await sprites.writeFile(name, `${lab.LAB_DIR}/validate.py`, lab.VALIDATOR);
      for (const file of files ?? []) {
        await sprites.writeFile(
          name,
          `${lab.LAB_DIR}/${file.name as string}`,
          file.content as string,
        );
      }
      const result = await sprites.exec(name, lab.RUN_VALIDATOR);
      const raw = result.stdout.trim();
      const jsonLine = raw.split("\n").reverse().find((line) => line.trim().startsWith("{"));
      if (!jsonLine) {
        return {
          ok: false as const,
          report: null as ComposeIssueReport | null,
          raw: raw.slice(-8000),
          message: "The validator produced no result — reinstall the toolkit.",
        };
      }
      const report = JSON.parse(jsonLine) as ComposeIssueReport;
      const stamp = new Date().toISOString();
      await context.supabase
        .from("compose_files")
        .update({ last_result: report as unknown as any, last_validated_at: stamp })
        .eq("user_id", context.userId)
        .eq("name", "docker-compose.yml");

      return {
        ok: report.errors.length === 0,
        report,
        raw: raw.slice(-8000),
        message: "",
      };
    } catch (error) {
      return {
        ok: false as const,
        report: null as ComposeIssueReport | null,
        raw: "",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

/** Registers the lab's stack as a docker-local agent connection. */
export const adoptComposeAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: files } = await context.supabase
      .from("compose_files")
      .select("name, content")
      .eq("user_id", context.userId);
    const env = (files ?? []).find((f: any) => f.name === ".env");
    const values: Record<string, string> = {};
    for (const line of String(env?.content ?? "").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      values[key!.trim()] = rest.join("=").trim();
    }
    const port = values["AGENT_PORT"] || "8085";
    const baseUrl = `http://localhost:${port}/cloud-agent`;
    const apiKey = values["ADMIN_TOKEN"] || "";

    const { data: existing } = await context.supabase
      .from("agent_connections")
      .select("id")
      .eq("user_id", context.userId)
      .eq("mode", "docker")
      .eq("base_url", baseUrl)
      .maybeSingle();

    if (existing) {
      await context.supabase
        .from("agent_connections")
        .update({ api_key: apiKey || null })
        .eq("id", existing.id)
        .eq("user_id", context.userId);
      return { ok: true as const, id: existing.id as string, baseUrl, created: false };
    }

    const { data: row, error } = await context.supabase
      .from("agent_connections")
      .insert({
        user_id: context.userId,
        name: "Compose lab (docker local)",
        mode: "docker",
        base_url: baseUrl,
        api_key: apiKey || null,
        provision_status: "manual",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id as string, baseUrl, created: true };
  });
