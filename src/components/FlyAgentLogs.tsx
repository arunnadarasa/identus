import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Copy, RefreshCw, ScrollText } from "lucide-react";
import { flyAgentLogs } from "@/lib/identus/fly.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

/**
 * Container log tail for the deployed Cloud Agent. Machine state and Fly's
 * health checks tell you *that* an agent is down; only the container log tells
 * you why — a crashed JVM, an unreachable Postgres, or a migration still
 * running.
 */
export function FlyAgentLogs({
  connectionId,
  autoRefresh = false,
}: {
  connectionId: string;
  autoRefresh?: boolean;
}) {
  const fetchLogs = useServerFn(flyAgentLogs);
  const query = useQuery({
    queryKey: ["fly-agent-logs", connectionId],
    queryFn: () => fetchLogs({ data: { id: connectionId } }),
    enabled: false,
    refetchInterval: autoRefresh ? 20000 : false,
  });

  const report = query.data;
  const lines = report?.lines ?? [];

  const copy = async () => {
    const text = lines.map((l) => `${l.at} ${l.level} ${l.message}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Agent log copied");
  };

  return (
    <Collapsible defaultOpen={autoRefresh}>
      <div className="rounded-lg border border-border/60 bg-card/40">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2">
              <ScrollText className="h-4 w-4" aria-hidden="true" />
              Agent logs
            </Button>
          </CollapsibleTrigger>
          {report?.machineName ? (
            <Badge variant="outline" className="font-mono text-xs">
              {report.machineName}
              {report.machineState ? ` · ${report.machineState}` : ""}
            </Badge>
          ) : null}
          {report?.fatal ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              failure found
            </Badge>
          ) : lines.length ? (
            <Badge variant="outline">{lines.length} lines</Badge>
          ) : report && !report.producedOutput ? (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              no output
            </Badge>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {lines.length ? (
              <Button variant="ghost" size="sm" className="gap-2" onClick={copy}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy log
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            >
              <RefreshCw
                className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {query.isFetching ? "Reading…" : lines.length ? "Refresh" : "Fetch logs"}
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="space-y-3 border-t border-border/60 p-3">
            {query.isError ? (
              <p className="text-sm text-destructive">
                {query.error instanceof Error ? query.error.message : "Could not read the logs."}
              </p>
            ) : null}

            {report && !report.ok ? (
              <p className="text-sm text-destructive">{report.message}</p>
            ) : null}

            {report?.diagnosis ? (
              <p
                className={`rounded-md border px-3 py-2 text-sm ${
                  report.fatal
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border/60 bg-muted/30 text-muted-foreground"
                }`}
              >
                {report.diagnosis}
              </p>
            ) : null}

            {lines.length ? (
              <div className="max-h-80 overflow-auto rounded-md bg-background/80 p-3 font-mono text-xs leading-relaxed">
                {lines.map((line, index) => (
                  <div
                    key={`${line.at}-${index}`}
                    className={
                      /error|exception|fatal/i.test(line.message)
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    <span className="mr-2 opacity-60">{line.at.slice(11, 19)}</span>
                    <span className="whitespace-pre-wrap break-all">{line.message}</span>
                  </div>
                ))}
              </div>
            ) : !query.isFetching && !query.isError ? (
              <p className="text-sm text-muted-foreground">
                Read the Cloud Agent's container output to see exactly where boot stops.
              </p>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
