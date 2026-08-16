import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  Cpu,
  Globe,
  RefreshCw,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  flyAllocateIps,
  flyMachineDiagnostics,
  flyRepairAgentMachine,
  flyRepairDidcomm,
} from "@/lib/identus/fly.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Reads the deployed machines' real state: Fly health-check output, exit codes
 * and OOM kills. This is what tells you whether an agent that reports "started"
 * is actually crash-looping, still migrating, or simply unreachable.
 */
export function FlyMachineDiagnostics({
  connectionId,
  autoRefresh = false,
}: {
  connectionId: string;
  autoRefresh?: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(flyMachineDiagnostics);
  const allocate = useServerFn(flyAllocateIps);
  const repairAgent = useServerFn(flyRepairAgentMachine);
  const query = useQuery({
    queryKey: ["fly-diagnostics", connectionId],
    queryFn: () => load({ data: { id: connectionId } }),
    refetchInterval: autoRefresh ? 20_000 : false,
    staleTime: 10_000,
  });

  const repair = useMutation({
    mutationFn: () => allocate({ data: { id: connectionId } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      query.refetch();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not allocate an IP."),
  });

  const repairMachine = useMutation({
    mutationFn: () => repairAgent({ data: { id: connectionId, cpus: 4, memoryMb: 4096 } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      query.refetch();
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["fly-agent-logs", connectionId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not repair the machine."),
  });

  const machines = query.data?.machines ?? [];
  const ips: { address: string; type: string }[] = query.data?.ips ?? [];
  const agent = machines.find((m) => m.name.includes("cloud-agent"));
  const agentNeedsRepair = Boolean(
    agent && (agent.state !== "started" || agent.events.some((e) => e.oomKilled)),
  );


  return (
    <Collapsible>
      <div className="flex flex-wrap items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
            <Stethoscope className="mr-2 h-3.5 w-3.5" />
            Machine diagnostics
          </Button>
        </CollapsibleTrigger>
        {query.data?.fatal ? (
          <Badge variant="outline" className="border-destructive/50 text-xs text-destructive">
            needs attention
          </Badge>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className={`mr-2 h-3 w-3 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <CollapsibleContent className="pt-2">
        <div className="space-y-2 rounded-md border border-border/60 bg-card/40 p-3 text-xs">
          {query.isLoading ? <p className="text-muted-foreground">Reading machines…</p> : null}
          {query.data && !query.data.ok ? (
            <p className="text-destructive">{query.data.message}</p>
          ) : null}
          {query.data?.ok && machines.length === 0 ? (
            <p className="text-muted-foreground">No machines found in this app.</p>
          ) : null}

          {query.data?.ok && ips.length === 0 ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
              <p className="text-destructive">
                This app has no public IP, so <span className="font-mono">{query.data.appName}.fly.dev</span>{" "}
                does not resolve — every health probe fails before it reaches the container, however
                healthy the machines are.
                {query.data.ipsMessage ? ` (${query.data.ipsMessage})` : ""}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={repair.isPending}
                onClick={() => repair.mutate()}
              >
                <Globe className="mr-2 h-3 w-3" />
                {repair.isPending ? "Allocating…" : "Allocate public IP"}
              </Button>
            </div>
          ) : ips.length ? (
            <p className="text-muted-foreground">
              Public IPs: {ips.map((ip) => `${ip.type} ${ip.address}`).join(", ")}
            </p>
          ) : null}

          {agentNeedsRepair && agent ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
              <p className="text-destructive">
                The Cloud Agent machine is <span className="font-mono">{agent.state}</span>
                {agent.memoryMb ? ` at ${Math.round(agent.memoryMb / 1024)} GB` : ""}, so nothing
                answers on the public URL. Repairing gives it 4 shared CPUs and 4 GB — enough for the
                four first-boot database migrations — and starts it again.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={repairMachine.isPending}
                onClick={() => repairMachine.mutate()}
              >
                <Wrench className="mr-2 h-3 w-3" />
                {repairMachine.isPending ? "Repairing…" : "Repair agent machine (4 GB)"}
              </Button>
            </div>
          ) : null}

          {machines.map((m) => (
            <div key={m.id} className="space-y-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-foreground">{m.name}</span>
                <Badge
                  variant="outline"
                  className={
                    m.state === "started"
                      ? "border-success/50 text-success"
                      : "border-border text-muted-foreground"
                  }
                >
                  {m.state}
                </Badge>
                <span className="text-muted-foreground">{m.region}</span>
                {m.memoryMb ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Cpu className="h-3 w-3" />
                    {m.cpus ?? "?"} cpu · {Math.round(m.memoryMb / 1024)} GB
                  </span>
                ) : null}
              </div>

              <p
                className={`flex items-start gap-2 ${
                  m.fatal ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {m.fatal ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                )}
                <span>{m.diagnosis}</span>
              </p>

              {m.privateIp ? (
                <p className="break-all font-mono text-muted-foreground">
                  private ip {m.privateIp}
                </p>
              ) : null}
              {m.image ? (
                <p className="break-all font-mono text-muted-foreground">{m.image}</p>
              ) : null}

              {m.checks.length ? (
                <ul className="space-y-1">
                  {m.checks.map((c) => (
                    <li key={c.name} className="font-mono">
                      <span className="text-muted-foreground">{c.name}</span>{" "}
                      <span className={c.status === "passing" ? "text-primary" : "text-destructive"}>
                        {c.status || "unknown"}
                      </span>
                      {c.output ? (
                        <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[11px] text-muted-foreground">
                          {c.output.slice(0, 600)}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {m.events.length ? (
                <ul className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  {m.events.map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      {e.at.slice(11, 19)} {e.type}
                      {e.status ? ` · ${e.status}` : ""}
                      {e.exitCode !== null ? (
                        <span className={e.exitCode === 0 ? "" : "text-destructive"}>
                          {" "}
                          · exit {e.exitCode}
                        </span>
                      ) : null}
                      {e.oomKilled ? <span className="text-destructive"> · out of memory</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
