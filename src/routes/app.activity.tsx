import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/identus.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/activity")({
  ssr: false,
  component: Activity,
});

function Activity() {
  const fetchWorkspace = useServerFn(getWorkspace);
  const { data } = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const entries = (data?.activity ?? []) as any[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Activity trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every protocol step your agents performed, newest first.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 border-b border-border/50 pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-mono text-xs text-primary">{entry.kind}</span>
                    <Badge
                      variant="outline"
                      className={
                        entry.status === "ok"
                          ? "border-success/40 text-success text-[10px]"
                          : "border-destructive/40 text-destructive text-[10px]"
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
                </div>
                <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
