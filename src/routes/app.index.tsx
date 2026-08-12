import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/identus.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MODE_LABELS, type AgentMode } from "@/lib/identus/types";
import { AgentHealthPanel } from "@/components/AgentHealthPanel";

export const Route = createFileRoute("/app/")({
  ssr: false,
  component: Overview,
});

function Overview() {
  const fetchWorkspace = useServerFn(getWorkspace);
  const { data, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace(),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
  }

  const active = data.active as any;
  const stats = [
    { label: "DIDs", value: data.dids.length, to: "/app/dids" },
    { label: "Connections", value: data.peers.length, to: "/app/dids" },
    { label: "Credentials", value: data.credentials.length, to: "/app/credentials" },
    { label: "Schemas", value: data.schemas.length, to: "/app/credentials" },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your active agent and everything it has produced so far.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display">
              {active ? active.name : "No agent configured"}
            </CardTitle>
            <CardDescription className="pt-1">
              {active
                ? `${MODE_LABELS[active.mode as AgentMode]} · ${
                    active.base_url ?? "in-app runtime"
                  }`
                : "Add an agent to start issuing credentials."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {active ? (
              <Badge
                variant="outline"
                className={
                  active.last_health === "healthy"
                    ? "border-success/50 text-success"
                    : "border-warning/50 text-warning"
                }
              >
                {active.last_health ?? "unknown"}
              </Badge>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link to="/app/agents">Manage agents</Link>
            </Button>
          </div>
        </CardHeader>
        {active ? (
          <CardContent>
            <AgentHealthPanel
              connectionId={active.id}
              lastProbe={active.last_probe ?? null}
              lastCheckedAt={active.last_checked_at ?? null}
            />
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to}>
            <Card className="border-border/60 transition-colors hover:border-primary/50">
              <CardContent className="pt-6">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="font-display mt-2 text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
          ) : (
            data.activity.slice(0, 8).map((entry: any) => (
              <div key={entry.id} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <span className="font-mono text-xs text-primary">{entry.kind}</span>
                  <p className="text-muted-foreground">{entry.summary}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
