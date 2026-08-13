import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, Loader2, RefreshCw, X } from "lucide-react";
import {
  flyPreflight,
  provisionFlyAgent,
  destroyFlyApp,
} from "@/lib/identus/fly.functions";
import { listConnections, setActiveConnection } from "@/lib/identus.functions";
import { ProvisionLogViewer } from "@/components/ProvisionLogViewer";
import { FlyMachineDiagnostics } from "@/components/FlyMachineDiagnostics";
import { FlyAgentLogs } from "@/components/FlyAgentLogs";
import type { ProvisionStep } from "@/lib/identus/types";
import {
  useAgentReadiness,
  formatDuration,
} from "@/components/AgentReadinessWatcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const REGIONS = ["lhr", "ams", "fra", "iad", "ord", "sjc", "syd", "nrt"];
const SIZES = [
  { label: "4 shared CPUs · 4 GB (recommended)", cpus: 4, memoryMb: 4096 },
  { label: "2 shared CPUs · 2 GB (may fail on first boot)", cpus: 2, memoryMb: 2048 },
  { label: "8 shared CPUs · 8 GB", cpus: 8, memoryMb: 8192 },
];

function randomKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Phase = "idle" | "deploying" | "done" | "failed";

interface StepEntry {
  step: string;
  status: string;
  detail?: string;
}

export function FlyDeployPanel({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const preflight = useServerFn(flyPreflight);
  const provision = useServerFn(provisionFlyAgent);
  const destroy = useServerFn(destroyFlyApp);
  const fetchConnections = useServerFn(listConnections);
  const activate = useServerFn(setActiveConnection);
  

  const [appName, setAppName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [region, setRegion] = useState("lhr");
  const [adminKey, setAdminKey] = useState(randomKey);
  const [pgPassword, setPgPassword] = useState(randomKey);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [error, setError] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [agentState, setAgentState] = useState<"booting" | "healthy" | "">("");
  const [deployedAt, setDeployedAt] = useState<string | null>(null);

  const preflightQuery = useQuery({
    queryKey: ["fly-preflight"],
    queryFn: () => preflight({ data: {} }),
    staleTime: 60_000,
  });

  useEffect(() => {
    const data = preflightQuery.data;
    if (!data?.ok) return;
    if (!appName && data.suggested) setAppName(data.suggested);
    if (!orgSlug && data.orgs.length) setOrgSlug(data.orgs[0]!.slug);
  }, [preflightQuery.data]);

  // The provisioning row is inserted before the first Fly call, so while the deploy
  // request is still in flight we discover its id by app name and hand it to the
  // log viewer, which then streams the steps itself.
  const discoveryQuery = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetchConnections(),
    refetchInterval: phase === "deploying" && !connectionId ? 2500 : false,
    enabled: phase === "deploying" && !connectionId,
  });

  useEffect(() => {
    if (connectionId) return;
    const rows = (discoveryQuery.data ?? []) as { id: string; fly_app_name?: string | null }[];
    const row = rows.find((r) => r.fly_app_name === appName);
    if (row) setConnectionId(row.id);
  }, [discoveryQuery.data, appName, connectionId]);


  const orgs = preflightQuery.data?.ok ? preflightQuery.data.orgs : [];
  const tokenProblem = preflightQuery.data && !preflightQuery.data.ok ? preflightQuery.data.message : "";
  const nameValid = /^[a-z0-9-]{4,40}$/.test(appName);

  // Fly rejects a duplicate app name with a 422 on the very first call, so the
  // name is checked while it is being typed and the deploy button is gated on
  // the result — retrying a taken name can never succeed.
  const [debouncedName, setDebouncedName] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(appName), 400);
    return () => clearTimeout(t);
  }, [appName]);

  const nameCheck = useQuery({
    queryKey: ["fly-name-check", debouncedName],
    queryFn: () => preflight({ data: { appName: debouncedName } }),
    enabled: /^[a-z0-9-]{4,40}$/.test(debouncedName),
    staleTime: 15_000,
  });
  const nameTaken = Boolean(
    nameCheck.data?.ok && nameCheck.data.taken && debouncedName === appName,
  );
  const checkingName = nameCheck.isFetching && debouncedName === appName;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const deploy = async () => {
    if (!nameValid || !orgSlug || nameTaken) return;
    setPhase("deploying");
    setSteps([]);
    setError("");
    setFailureReason("");
    setAppCreated(true);
    setAgentState("");
    setDeployedAt(null);
    setConnectionId(null);
    const size = SIZES[sizeIndex]!;
    const result = await provision({
      data: {
        appName,
        orgSlug,
        region,
        adminKey,
        pgPassword,
        cpus: size.cpus,
        memoryMb: size.memoryMb,
      },
    });
    setSteps(result.steps as StepEntry[]);
    setConnectionId(result.connectionId);
    setAppCreated(result.appCreated);

    onChanged();
    qc.invalidateQueries({ queryKey: ["connections"] });
    if (result.ok) {
      setBaseUrl(result.baseUrl);
      setPhase("done");
      setAgentState("booting");
      setDeployedAt(new Date().toISOString());
      toast.success(`${appName} deployed — checking readiness automatically.`);
    } else {
      setError(result.message ?? "Provisioning failed");
      setFailureReason(result.reason ?? "");
      // A name collision is only fixable with a different name, so a free one is
      // filled in immediately and Retry becomes a deploy that can work.
      if (result.reason === "name_taken" && result.suggestedName) {
        setAppName(result.suggestedName);
        setAdvanced(true);
      }
      setPhase("failed");
      toast.error(result.message ?? "Provisioning failed");
    }
  };

  // Automatic readiness watcher: starts as soon as provisioning succeeds and keeps
  // polling (5s for the first minute, then 15s, up to 10 minutes) until ready.
  const readiness = useAgentReadiness(phase === "done" ? connectionId : null, {
    active: phase === "done",
    startedAt: deployedAt,
    attempts: 0,
  });

  const cleanup = async () => {
    if (!connectionId) return;
    await destroy({ data: { id: connectionId } });
    setPhase("idle");
    setSteps([]);
    setConnectionId(null);
    setAppName(`identus-agent-${randomKey().slice(0, 4)}`);
    onChanged();
    toast.success("Fly app cleaned up");
  };

  return (
    <div className="space-y-5 pt-4">
      {tokenProblem ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Fly API token not usable yet: {tokenProblem}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        One click deploys three machines into your Fly organisation — Postgres, a PRISM node and the
        Identus Cloud Agent — then wires this console to it with the admin API key below.
      </p>

      <div className="rounded-md border border-border/60 bg-secondary/30 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs">
          <span className="text-muted-foreground">
            app <span className="text-foreground">{appName || "…"}</span>
          </span>
          <span className="text-muted-foreground">
            org{" "}
            <span className="text-foreground">
              {orgs.find((o) => o.slug === orgSlug)?.name ?? orgSlug ?? "…"}
            </span>
          </span>
          <span className="text-muted-foreground">
            region <span className="text-foreground">{region}</span>
          </span>
          <span className="text-muted-foreground">
            size <span className="text-foreground">{SIZES[sizeIndex]!.label}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${advanced ? "rotate-180" : ""}`} />
        Advanced — app name, organisation, region, credentials
      </button>

      {advanced ? (
        <div className="grid gap-4 rounded-md border border-border/60 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fly-app">App name</Label>
            <Input
              id="fly-app"
              value={appName}
              onChange={(e) => setAppName(e.target.value.toLowerCase())}
            />
            {appName && !nameValid ? (
              <p className="text-xs text-destructive">
                4–40 characters: lowercase letters, numbers and dashes.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Organisation</Label>
            <Select value={orgSlug} onValueChange={setOrgSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.slug}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Agent machine size</Label>
            <Select value={String(sizeIndex)} onValueChange={(v) => setSizeIndex(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s, i) => (
                  <SelectItem key={s.label} value={String(i)}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fly-admin">Admin API key</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setAdminKey(randomKey())}
              >
                Regenerate
              </button>
            </div>
            <Input
              id="fly-admin"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fly-pg">Postgres password</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPgPassword(randomKey())}
              >
                Regenerate
              </button>
            </div>
            <Input
              id="fly-pg"
              value={pgPassword}
              onChange={(e) => setPgPassword(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          className="h-11 w-full sm:h-10 sm:w-auto"
          disabled={phase === "deploying" || !nameValid || !orgSlug || !!tokenProblem}
          onClick={deploy}
        >
          {phase === "deploying" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Deploying…
            </>
          ) : (
            "Deploy Cloud Agent to Fly.io"
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={preflightQuery.isFetching}
          onClick={() => preflightQuery.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recheck token
        </Button>
      </div>

      {connectionId || steps.length ? (
        <ProvisionLogViewer
          connectionId={connectionId}
          live={phase === "deploying"}
          fallbackSteps={steps as ProvisionStep[]}
        />
      ) : null}


      {phase === "failed" ? (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={deploy}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={cleanup}>
              Clean up app
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="space-y-3 rounded-md border border-success/40 bg-success/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-semibold">Agent credentials</p>
            <Badge variant="outline" className="border-border text-xs">
              {readiness.status === "ready"
                ? "ready"
                : readiness.status === "timeout"
                  ? "not responding"
                  : "booting…"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored on this connection and used for every REST call. Copy it now if you want it
            elsewhere — the agent will not print it again.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background/60 px-3 py-2">
              <span className="min-w-0 truncate">{baseUrl}</span>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => copy(baseUrl, "Agent URL")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background/60 px-3 py-2">
              <span className="min-w-0 truncate">{adminKey}</span>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => copy(adminKey, "Admin API key")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Automatic readiness progress — no manual refreshing needed. */}
          <div className="space-y-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              {readiness.status === "ready" ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : readiness.status === "timeout" ? (
                <X className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              )}
              <span className="text-muted-foreground">
                {readiness.status === "ready"
                  ? `Agent responded and is ready (after ${formatDuration(readiness.elapsedMs)})`
                  : readiness.status === "timeout"
                    ? `Agent still not responding after ${formatDuration(readiness.elapsedMs)}`
                    : `Waiting for the agent to answer… attempt ${readiness.attempts || 1} · ${formatDuration(readiness.elapsedMs)} elapsed`}
              </span>
            </div>
            {readiness.probe?.checks?.length ? (
              <ul className="grid gap-1 sm:grid-cols-2">
                {readiness.probe.checks.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 font-mono">
                    <span className="min-w-0 truncate text-muted-foreground">{c.label}</span>
                    <span className={c.ok ? "text-primary" : "text-destructive"}>
                      {c.ok ? `${c.ms}ms` : (c.status ?? "down")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {readiness.status === "timeout" ? (
              <Button size="sm" variant="outline" onClick={readiness.retry} disabled={readiness.running}>
                <RefreshCw className={`mr-2 h-3 w-3 ${readiness.running ? "animate-spin" : ""}`} />
                Keep checking
              </Button>
            ) : null}
          </div>

          {/* Machine state and container logs, so a silent agent can be
              diagnosed and repaired without leaving the deploy flow. */}
          {connectionId ? (
            <div className="space-y-2">
              <FlyMachineDiagnostics
                connectionId={connectionId}
                autoRefresh={readiness.status !== "ready"}
              />
              <FlyAgentLogs connectionId={connectionId} />
            </div>
          ) : null}

          <Button
            size="sm"
            className="h-11 w-full sm:h-9 sm:w-auto"
            disabled={readiness.status !== "ready"}
            onClick={async () => {
              if (!connectionId) return;
              await activate({ data: { id: connectionId } });
              onChanged();
              toast.success("Fly agent is now the active agent");
            }}
          >
            {readiness.status === "ready" ? "Use this agent" : "Waiting for agent…"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
