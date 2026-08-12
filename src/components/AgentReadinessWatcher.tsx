import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { awaitAgentReady } from "@/lib/identus.functions";
import { Button } from "@/components/ui/button";
import type { ProbeResult, ReadinessStatus } from "@/lib/identus/types";

const TIMEOUT_MS = 600_000; // 10 minutes
const FAST_PHASE_MS = 60_000; // first minute polls every 5s
const FAST_INTERVAL = 5_000;
const SLOW_INTERVAL = 15_000;

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

interface ReadinessState {
  status: ReadinessStatus;
  attempts: number;
  elapsedMs: number;
  message: string;
  probe: ProbeResult | null;
}

/**
 * Polls the readiness endpoint automatically until the agent reports ready or the
 * 10-minute budget is exhausted. Backs off from 5s to 15s after the first minute.
 */
export function useAgentReadiness(
  connectionId: string | null,
  options: { active: boolean; startedAt?: string | null; attempts?: number },
) {
  const check = useServerFn(awaitAgentReady);
  const qc = useQueryClient();
  const [state, setState] = useState<ReadinessState>({
    status: "unknown",
    attempts: options.attempts ?? 0,
    elapsedMs: 0,
    message: "",
    probe: null,
  });
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const stop = useCallback(() => {
    cancelled.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setRunning(false);
  }, []);

  const run = useCallback(
    (delay = 0) => {
      if (!connectionId) return;
      cancelled.current = false;
      setRunning(true);
      const tick = async () => {
        if (cancelled.current) return;
        try {
          const result = await check({ data: { id: connectionId, timeoutMs: TIMEOUT_MS } });
          if (cancelled.current) return;
          setState({
            status: result.status as ReadinessStatus,
            attempts: result.attempts,
            elapsedMs: result.elapsedMs,
            message: result.message,
            probe: result.probe as ProbeResult,
          });
          qc.invalidateQueries({ queryKey: ["connections"] });
          if (result.status === "waiting") {
            const next = result.elapsedMs < FAST_PHASE_MS ? FAST_INTERVAL : SLOW_INTERVAL;
            timer.current = setTimeout(tick, next);
            return;
          }
          setRunning(false);
        } catch (error) {
          if (cancelled.current) return;
          setState((prev) => ({
            ...prev,
            message: error instanceof Error ? error.message : String(error),
          }));
          timer.current = setTimeout(tick, SLOW_INTERVAL);
        }
      };
      timer.current = setTimeout(tick, delay);
    },
    [connectionId, check, qc],
  );

  // Start automatically as soon as the agent is flagged as waiting.
  useEffect(() => {
    if (!options.active || !connectionId) return;
    run(2_000);
    return stop;
  }, [options.active, connectionId, run, stop]);

  // Live elapsed clock while waiting.
  const [tickNow, setTickNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsedMs = options.startedAt
    ? Math.max(state.elapsedMs, tickNow - new Date(options.startedAt).getTime())
    : state.elapsedMs;

  return { ...state, elapsedMs, running, retry: () => run(0), stop };
}

export function AgentReadinessStatus({
  connectionId,
  status,
  startedAt,
  attempts,
  readyAt,
}: {
  connectionId: string;
  status: ReadinessStatus;
  startedAt: string | null;
  attempts: number;
  readyAt?: string | null;
}) {
  const watcher = useAgentReadiness(connectionId, {
    active: status === "waiting",
    startedAt,
    attempts,
  });
  const current = watcher.status === "unknown" ? status : watcher.status;

  if (current === "unknown") return null;

  if (current === "ready") {
    const bootMs =
      readyAt && startedAt ? new Date(readyAt).getTime() - new Date(startedAt).getTime() : 0;
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-primary" />
        <span className="text-foreground">Agent ready</span>
        {bootMs > 0 ? <span>· booted in {formatDuration(bootMs)}</span> : null}
      </div>
    );
  }

  if (current === "timeout") {
    return (
      <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Agent did not become ready in time</span>
        </div>
        {watcher.message ? <p className="text-muted-foreground">{watcher.message}</p> : null}
        <Button size="sm" variant="outline" onClick={watcher.retry} disabled={watcher.running}>
          <RefreshCw className={`mr-2 h-3 w-3 ${watcher.running ? "animate-spin" : ""}`} />
          Check again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>
          Waiting for the agent… (attempt {Math.max(watcher.attempts, attempts) || 1},{" "}
          {formatDuration(watcher.elapsedMs)} elapsed)
        </span>
      </div>
      <p className="text-muted-foreground">
        {watcher.elapsedMs > 90_000
          ? "Still no HTTP response. The Cloud Agent migrates four databases on first boot, which can take several minutes — open machine diagnostics below to see whether it is migrating or crash-looping."
          : "The agent is booting and migrating its databases before it answers."}
      </p>
      {watcher.probe?.checks?.length ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {watcher.probe.checks.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 font-mono">
              <span className="text-muted-foreground">{c.label}</span>
              <span className={c.ok ? "text-primary" : "text-destructive"}>
                {c.ok ? `${c.ms}ms` : (c.status ?? "down")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

}
