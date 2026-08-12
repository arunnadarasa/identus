import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronRight, Copy, Loader2 } from "lucide-react";
import { getProvisionLog } from "@/lib/identus/fly.functions";
import type { ProvisionStep } from "@/lib/identus/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatMs(ms?: number) {
  if (ms === undefined) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatClock(at: string) {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toISOString().slice(11, 19);
}

function StatusIcon({ status }: { status: ProvisionStep["status"] }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />;
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  return <Check className="h-3.5 w-3.5 shrink-0 text-primary" />;
}

function StepRow({ entry }: { entry: ProvisionStep }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(entry.endpoint || entry.raw || entry.httpStatus);

  return (
    <li className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs hover:bg-muted/40 disabled:cursor-default"
        disabled={!hasDetail}
      >
        <span className="text-muted-foreground/70">{formatClock(entry.at)}</span>
        <StatusIcon status={entry.status} />
        <span
          className={
            entry.status === "error" ? "text-destructive" : "text-foreground"
          }
        >
          {entry.step}
        </span>
        {entry.detail ? (
          <span className="truncate text-muted-foreground">— {entry.detail}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground/70">
          {formatMs(entry.durationMs)}
          {hasDetail ? (
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
            />
          ) : null}
        </span>
      </button>
      {open && hasDetail ? (
        <div className="space-y-1 border-t border-border/40 bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {entry.endpoint ? <div>call: {entry.endpoint}</div> : null}
          {entry.httpStatus ? <div>http: {entry.httpStatus}</div> : null}
          {entry.raw ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-foreground/80">
              {entry.raw}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

interface Props {
  connectionId: string | null;
  /** Poll while the deploy is in flight. */
  live?: boolean;
  /** Steps returned synchronously by provisionFlyAgent, used until the poll lands. */
  fallbackSteps?: ProvisionStep[];
  showMachines?: boolean;
}

export function ProvisionLogViewer({
  connectionId,
  live = false,
  fallbackSteps = [],
  showMachines = true,
}: Props) {
  const fetchLog = useServerFn(getProvisionLog);
  const scroller = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["provision-log", connectionId],
    queryFn: () =>
      fetchLog({ data: { id: connectionId!, includeMachines: showMachines } }),
    enabled: Boolean(connectionId),
    refetchInterval: (q) =>
      live || q.state.data?.status === "provisioning" ? 2500 : false,
  });

  const steps = useMemo<ProvisionStep[]>(() => {
    const fromServer = query.data?.steps ?? [];
    return fromServer.length >= fallbackSteps.length ? fromServer : fallbackSteps;
  }, [query.data, fallbackSteps]);

  const running = steps.some((s) => s.status === "running");

  // Keep the newest line in view while the deploy streams in.
  useEffect(() => {
    if (!running || !scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [steps.length, running]);

  const copyAll = async () => {
    const text = steps
      .map((s) => {
        const head = `[${formatClock(s.at)}] ${s.status.toUpperCase()} ${s.step}${
          s.detail ? ` — ${s.detail}` : ""
        }${s.durationMs !== undefined ? ` (${formatMs(s.durationMs)})` : ""}`;
        const extra = [
          s.endpoint ? `    call: ${s.endpoint}` : "",
          s.httpStatus ? `    http: ${s.httpStatus}` : "",
          s.raw ? `    ${s.raw.replace(/\n/g, "\n    ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return extra ? `${head}\n${extra}` : head;
      })
      .join("\n");
    await navigator.clipboard.writeText(text || "(no steps recorded)");
    toast.success("Provisioning log copied");
  };

  if (!connectionId) return null;

  const machines = query.data?.machines ?? [];

  return (
    <div className="rounded-lg border border-border/60 bg-card/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-medium">Provisioning log</span>
          {query.data?.status ? (
            <Badge
              variant="outline"
              className={
                query.data.status === "failed"
                  ? "border-destructive/50 text-destructive"
                  : query.data.status === "ready"
                    ? "border-primary/40 text-primary"
                    : ""
              }
            >
              {query.data.status}
            </Badge>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={copyAll}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy log
        </Button>
      </div>

      <div ref={scroller} className="max-h-80 overflow-auto">
        {steps.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {query.isLoading ? "Loading log…" : "No provisioning steps recorded yet."}
          </p>
        ) : (
          <ul>
            {steps.map((entry, i) => (
              <StepRow key={`${entry.step}-${entry.at}-${i}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      {showMachines && (machines.length > 0 || query.data?.machinesMessage) ? (
        <div className="space-y-1 border-t border-border/60 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Fly machines</p>
          {query.data?.machinesMessage ? (
            <p className="font-mono text-[11px] text-destructive">
              {query.data.machinesMessage}
            </p>
          ) : null}
          {machines.map((m) => (
            <div key={m.id} className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-foreground">{m.name}</span>
              <span className="text-muted-foreground">{m.region}</span>
              <Badge
                variant="outline"
                className={
                  m.state === "started"
                    ? "border-primary/40 text-primary"
                    : "border-border text-muted-foreground"
                }
              >
                {m.state}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
