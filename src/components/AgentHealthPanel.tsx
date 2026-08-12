import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";
import { diagnoseConnection } from "@/lib/identus.functions";
import { Button } from "@/components/ui/button";
import type { ProbeResult } from "@/lib/identus/types";

interface Props {
  connectionId: string;
  lastProbe?: ProbeResult | null;
  lastCheckedAt?: string | null;
  onChecked?: (result: ProbeResult) => void;
}

export function AgentHealthPanel({ connectionId, lastProbe, lastCheckedAt, onChecked }: Props) {
  const diagnose = useServerFn(diagnoseConnection);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(lastProbe ?? null);
  const [checkedAt, setCheckedAt] = useState<string | null>(lastCheckedAt ?? null);

  const run = async () => {
    setBusy(true);
    setOpen(true);
    try {
      const probe = (await diagnose({ data: { id: connectionId } })) as ProbeResult;
      setResult(probe);
      setCheckedAt(new Date().toISOString());
      onChecked?.(probe);
      probe.healthy ? toast.success(probe.message) : toast.error(probe.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Health check failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={run}>
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
            </>
          ) : (
            <>
              <Stethoscope className="h-3.5 w-3.5" /> Run health check
            </>
          )}
        </Button>
        {result ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            {result.checks.filter((c) => c.ok).length}/{result.checks.length} checks passed ·{" "}
            {result.totalMs}ms
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Not diagnosed yet</span>
        )}
      </div>

      {open && result ? (
        <div className="space-y-2 rounded-md border border-border/60 bg-secondary/30 p-3 font-mono text-xs">
          {result.checks.length === 0 ? (
            <p className="text-muted-foreground">{result.message}</p>
          ) : (
            result.checks.map((check) => (
              <div
                key={check.id}
                className={`flex items-start gap-2 ${check.ok ? "text-success" : "text-destructive"}`}
              >
                {check.ok ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="flex-1">
                  {check.label}
                  {check.detail ? ` — ${check.detail}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">{check.ms}ms</span>
              </div>
            ))
          )}
          <p className="pt-1 text-muted-foreground">
            {result.version ? `version ${result.version} · ` : ""}
            {checkedAt ? `checked ${new Date(checkedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
