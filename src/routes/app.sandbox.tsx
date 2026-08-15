import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Box,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { getSandbox, ensureSandbox, destroySandbox } from "@/lib/sprites/sandbox.functions";
import { SnippetRunner, type SnippetDraft } from "@/components/SnippetRunner";
import { SdkQuickstartPanel } from "@/components/SdkQuickstartPanel";
import { ComposeLabPanel } from "@/components/ComposeLabPanel";
import { ModeRecommendation } from "@/components/ModeRecommendation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProvisionStep } from "@/lib/identus/types";

export const Route = createFileRoute("/app/sandbox")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sandbox — Identus Companion" },
      {
        name: "description",
        content:
          "Run Identus SDK snippets and lint your docker-local Compose stack in a disposable micro-environment.",
      },
      { property: "og:title", content: "Sandbox — Identus Companion" },
      {
        property: "og:description",
        content:
          "SDK snippets plus a Docker Compose lab for Identus, without deploying a full agent stack.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sandbox,
});

/** Past this, a still-running step gets a "taking longer than expected" hint. */
const SLOW_STEP_MS = 45_000;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatElapsed(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function StepList({ steps }: { steps: ProvisionStep[] }) {
  const running = steps.some((s) => s.status === "running");
  const now = useNow(running);
  if (steps.length === 0) return null;
  return (
    <ul className="max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30">
      {steps.map((step, index) => {
        const startedAt = Date.parse(step.at);
        const elapsed =
          step.status === "running" && Number.isFinite(startedAt)
            ? Math.max(0, now - startedAt)
            : null;
        const slow = elapsed !== null && elapsed > SLOW_STEP_MS;
        return (
        <li
          key={`${step.step}-${index}`}
          className="flex items-start gap-2 border-b border-border/40 px-3 py-2 font-mono text-[11px] last:border-0"
        >
          {step.status === "running" ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : step.status === "error" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <div className={step.status === "error" ? "text-destructive" : ""}>{step.step}</div>
            {step.detail ? (
              <div className="break-words text-muted-foreground">{step.detail}</div>
            ) : null}
            {step.raw ? (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-muted-foreground/80">
                {step.raw}
              </pre>
            ) : null}
          </div>
          <span
            className={`ml-auto shrink-0 ${slow ? "text-warning" : "text-muted-foreground/70"}`}
          >
            {elapsed !== null
              ? formatElapsed(elapsed)
              : step.durationMs === undefined
                ? ""
                : formatElapsed(step.durationMs)}
          </span>
        </li>
        );
      })}
    </ul>
  );
}

function Sandbox() {
  const qc = useQueryClient();
  const fetchSandbox = useServerFn(getSandbox);
  const provision = useServerFn(ensureSandbox);
  const destroy = useServerFn(destroySandbox);

  const { data, isLoading } = useQuery({
    queryKey: ["sandbox"],
    queryFn: () => fetchSandbox(),
  });

  const [busy, setBusy] = useState<"create" | "reinstall" | "destroy" | null>(null);
  const [liveSteps, setLiveSteps] = useState<ProvisionStep[]>([]);
  const [draft, setDraft] = useState<SnippetDraft | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sandbox"] });

  const create = async (reinstall: boolean) => {
    setBusy(reinstall ? "reinstall" : "create");
    setLiveSteps([]);
    try {
      const res = await provision({ data: { reinstall } });
      setLiveSteps(res.steps as ProvisionStep[]);
      if (res.ok) toast.success("Sandbox ready");
      else toast.error(res.message || "Provisioning failed");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provisioning failed");
    } finally {
      setBusy(null);
    }
  };

  const tearDown = async () => {
    setBusy("destroy");
    try {
      const res = await destroy({});
      if (res.ok) toast.success("Sandbox destroyed");
      else toast.error(res.message || "Could not destroy the sandbox");
      setLiveSteps([]);
      invalidate();
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading your sandbox…</p>;
  }

  const steps = liveSteps.length ? liveSteps : (data.box?.steps ?? []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          Sandbox
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A private Linux box with Node and the Identus TypeScript SDK installed, so you can write
          and run snippets — or author and lint a Docker Compose stack — without deploying an agent.
        </p>
      </div>

      <Tabs defaultValue="sdk" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="sdk">SDK snippets</TabsTrigger>
          <TabsTrigger value="docker">Docker local</TabsTrigger>
        </TabsList>

        <TabsContent value="docker" className="space-y-6">
          <ComposeLabPanel />
        </TabsContent>

        <TabsContent value="sdk" className="space-y-8">
      <ModeRecommendation variant="sdk-sandbox" />

      <SdkQuickstartPanel
        onLoadIntoEditor={
          data.box
            ? (snippet) => setDraft({ ...snippet, token: Date.now() })
            : undefined
        }
      />



      {!data.hasToken ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="font-display text-base">Sandbox token missing</CardTitle>
            <CardDescription>
              Add a Sprites token to enable the sandbox. It is a different credential from your
              Fly.io token: copy the four-part value (org-slug/org-id/token-id/token-value) from
              your account page at sprites.dev.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              <CardTitle className="font-display text-base">Your box</CardTitle>
              {data.box ? (
                <Badge variant={data.box.status === "ready" ? "secondary" : "outline"}>
                  {data.box.status}
                </Badge>
              ) : null}
              {data.box?.sdkReady ? (
                <Badge variant="outline">
                  {(() => {
                    const version = data.box.steps
                      .map((s) => s.detail?.match(/SDK (\d[\w.\-+]*) imports cleanly/)?.[1])
                      .find(Boolean);
                    return version ? `SDK ${version}` : "SDK installed";
                  })()}
                </Badge>
              ) : null}

            </div>
            <CardDescription className="break-all font-mono text-xs">
              {data.box?.spriteName ?? data.suggestedName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.box?.url ? (
              <a
                href={data.box.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
              >
                {data.box.url}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => create(Boolean(data.box))}
                disabled={busy !== null || !data.hasToken}
                className="sm:w-auto"
              >
                {busy === "create" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Box className="mr-2 h-4 w-4" />
                )}
                {data.box ? "Repair box" : "Create sandbox"}
              </Button>
              {data.box ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => create(true)}
                    disabled={busy !== null}
                  >
                    {busy === "reinstall" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Reinstall SDK
                  </Button>
                  <Button variant="outline" onClick={tearDown} disabled={busy !== null}>
                    {busy === "destroy" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Destroy
                  </Button>
                </>
              ) : null}
            </div>

            <StepList steps={steps} />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Agent binding</CardTitle>
            <CardDescription>
              Snippets receive the active agent's base URL and admin key as environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.agent ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{data.agent.name}</span>
                  <Badge variant="outline">{data.agent.mode}</Badge>
                </div>
                <div className="space-y-1 font-mono text-xs text-muted-foreground">
                  <div className="break-all">
                    AGENT_BASE_URL={data.agent.baseUrl || "(none)"}
                  </div>
                  <div>AGENT_API_KEY={data.agent.apiKey ? "••••••••" : "(none)"}</div>
                </div>
                {data.agent.mode === "simulated" ? (
                  <p className="text-muted-foreground">
                    Simulated mode has no REST endpoint, so API calls from a snippet will fail.
                    Switch to a Docker local or Fly.io agent on the Agents page to exercise the real
                    API. SDK-only snippets (key generation, peer DIDs) still work.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                No active agent yet. Pick one on the Agents page — snippets can still run pure SDK
                code without it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <SnippetRunner data={data} draft={draft} />
        </TabsContent>
      </Tabs>
    </div>

  );
}
