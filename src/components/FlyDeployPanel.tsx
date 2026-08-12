import { useEffect, useMemo, useState } from "react";
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
  { label: "2 shared CPUs · 2 GB (recommended)", cpus: 2, memoryMb: 2048 },
  { label: "1 shared CPU · 1 GB (cheapest)", cpus: 1, memoryMb: 1024 },
  { label: "4 shared CPUs · 4 GB", cpus: 4, memoryMb: 4096 },
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

  // Live progress: while deploying, poll the connection row for provisioning steps.
  const progressQuery = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetchConnections(),
    refetchInterval: phase === "deploying" ? 2500 : false,
    enabled: phase === "deploying",
  });

  const liveSteps = useMemo(() => {
    const rows = (progressQuery.data ?? []) as any[];
    const row = rows.find((r) => r.fly_app_name === appName);
    return Array.isArray(row?.provision_log) ? (row.provision_log as StepEntry[]) : [];
  }, [progressQuery.data, appName]);

  const shown = phase === "deploying" && liveSteps.length > steps.length ? liveSteps : steps;
  const orgs = preflightQuery.data?.ok ? preflightQuery.data.orgs : [];
  const tokenProblem = preflightQuery.data && !preflightQuery.data.ok ? preflightQuery.data.message : "";
  const nameValid = /^[a-z0-9-]{4,40}$/.test(appName);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const deploy = async () => {
    if (!nameValid || !orgSlug) return;
    setPhase("deploying");
    setSteps([]);
    setError("");
    setAgentState("");
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
    onChanged();
    qc.invalidateQueries({ queryKey: ["connections"] });
    if (result.ok) {
      setBaseUrl(result.baseUrl);
      setPhase("done");
      setAgentState("booting");
      toast.success(`${appName} deployed — the agent is booting.`);
    } else {
      setError(result.message ?? "Provisioning failed");
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
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

      {shown.length ? (
        <div className="space-y-1 rounded-md border border-border/60 bg-secondary/30 p-4 font-mono text-xs">
          {shown.map((entry, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 ${entry.status === "error" ? "text-destructive" : "text-success"}`}
            >
              {entry.status === "error" ? (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {entry.step}
                {entry.detail ? ` — ${entry.detail}` : ""}
              </span>
            </div>
          ))}
          {phase === "deploying" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> working…
            </div>
          ) : null}
        </div>
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
              {agentState === "healthy" ? "healthy" : "booting…"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored on this connection and used for every REST call. Copy it now if you want it
            elsewhere — the agent will not print it again.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background/60 px-3 py-2">
              <span className="truncate">{baseUrl}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(baseUrl, "Agent URL")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background/60 px-3 py-2">
              <span className="truncate">{adminKey}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(adminKey, "Admin API key")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              if (!connectionId) return;
              await activate({ data: { id: connectionId } });
              onChanged();
              toast.success("Fly agent is now the active agent");
            }}
          >
            Use this agent
          </Button>
        </div>
      ) : null}
    </div>
  );
}
