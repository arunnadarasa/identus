import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listConnections,
  createConnection,
  deleteConnection,
  setActiveConnection,
  testConnection,
  diagnoseConnection,
} from "@/lib/identus.functions";
import { flyAppStatus, destroyFlyApp } from "@/lib/identus/fly.functions";
import { FlyDeployPanel } from "@/components/FlyDeployPanel";
import { AgentHealthPanel } from "@/components/AgentHealthPanel";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODE_LABELS, type AgentMode } from "@/lib/identus/types";

export const Route = createFileRoute("/app/agents")({
  ssr: false,
  component: Agents,
});

const REGIONS = ["lhr", "ams", "fra", "iad", "ord", "sjc", "syd", "nrt"];

function Agents() {
  const qc = useQueryClient();
  const fetchConnections = useServerFn(listConnections);
  const addConnection = useServerFn(createConnection);
  const removeConnection = useServerFn(deleteConnection);
  const activate = useServerFn(setActiveConnection);
  const health = useServerFn(testConnection);
  const status = useServerFn(flyAppStatus);
  const destroy = useServerFn(destroyFlyApp);

  const { data: connections } = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetchConnections(),
  });

  const [dockerUrl, setDockerUrl] = useState("http://localhost:8085/cloud-agent");
  const [dockerKey, setDockerKey] = useState("");
  const [simName, setSimName] = useState("Simulated agent");
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["connections"] });
    qc.invalidateQueries({ queryKey: ["workspace"] });
  };

  // Never switch to a real agent without confirming it responds first.
  const useAgent = async (conn: any) => {
    setSwitching(conn.id);
    try {
      if (conn.mode !== "simulated") {
        const probe = await diagnose({ data: { id: conn.id } });
        invalidate();
        if (!probe.healthy) {
          const failed = probe.checks.filter((c) => !c.ok).map((c) => c.label);
          const ok = confirm(
            `${conn.name} failed its health check.\n\n${probe.message}${
              failed.length ? `\n\nFailing: ${failed.join(", ")}` : ""
            }\n\nSwitch to it anyway?`,
          );
          if (!ok) {
            toast.error("Stayed on the current agent");
            return;
          }
        }
      }
      await activate({ data: { id: conn.id } });
      invalidate();
      toast.success(`${conn.name} is now the active agent`);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulated, Docker-local or a real Cloud Agent deployed to Fly.io.
        </p>
      </div>

      <div className="grid gap-4">
        {(connections ?? []).map((conn: any) => (
          <Card key={conn.id} className="border-border/60">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  {conn.name}
                  {conn.is_active ? <Badge className="text-xs">active</Badge> : null}
                </CardTitle>
                <CardDescription className="pt-1 font-mono text-xs">
                  {MODE_LABELS[conn.mode as AgentMode]}
                  {conn.base_url ? ` · ${conn.base_url}` : ""}
                  {conn.provision_status ? ` · ${conn.provision_status}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    conn.last_health === "healthy"
                      ? "border-success/50 text-success"
                      : "border-border text-muted-foreground"
                  }
                >
                  {conn.last_health ?? "untested"}
                </Badge>
                {!conn.is_active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={switching === conn.id}
                    onClick={() => useAgent(conn)}
                  >
                    {switching === conn.id ? "Checking…" : "Use"}
                  </Button>
                ) : null}
                {conn.mode === "fly" ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const result = await status({ data: { id: conn.id } });
                        invalidate();
                        toast.message(
                          result.machines.length
                            ? result.machines.map((m: any) => `${m.name}: ${m.state}`).join(" · ")
                            : result.message || "No machines found",
                          { description: result.health.message },
                        );
                      }}
                    >
                      Machines
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`Destroy Fly app ${conn.fly_app_name}? This is permanent.`))
                          return;
                        await destroy({ data: { id: conn.id } });
                        invalidate();
                        toast.success("Fly app destroyed");
                      }}
                    >
                      Destroy
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      await removeConnection({ data: { id: conn.id } });
                      invalidate();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </CardHeader>
            {Array.isArray(conn.provision_log) && conn.provision_log.length ? (
              <CardContent className="space-y-1 font-mono text-xs">
                {conn.provision_log.map((entry: any, index: number) => (
                  <div
                    key={index}
                    className={entry.status === "error" ? "text-destructive" : "text-success"}
                  >
                    {entry.status === "error" ? "✕" : "✓"} {entry.step}
                    {entry.detail ? ` — ${entry.detail}` : ""}
                  </div>
                ))}
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Add an agent</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="simulated">
            <TabsList>
              <TabsTrigger value="simulated">Simulated</TabsTrigger>
              <TabsTrigger value="docker">Docker local</TabsTrigger>
              <TabsTrigger value="fly">Fly.io</TabsTrigger>
            </TabsList>

            <TabsContent value="simulated" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                An in-app agent that mirrors Cloud Agent REST semantics — no infrastructure needed.
              </p>
              <div className="space-y-2">
                <Label htmlFor="sim-name">Name</Label>
                <Input id="sim-name" value={simName} onChange={(e) => setSimName(e.target.value)} />
              </div>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await addConnection({ data: { name: simName, mode: "simulated" } });
                  setBusy(false);
                  invalidate();
                  toast.success("Simulated agent added");
                }}
              >
                Add simulated agent
              </Button>
            </TabsContent>

            <TabsContent value="docker" className="space-y-4 pt-4">
              <div className="rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs leading-relaxed">
                git clone https://github.com/hyperledger-identus/cloud-agent
                <br />
                cd cloud-agent/infrastructure/local
                <br />
                ./run.sh
              </div>
              <p className="text-sm text-muted-foreground">
                The agent must be reachable from this browser. A localhost agent works in local
                development; expose it with a tunnel to use it from the hosted app.
              </p>
              <div className="space-y-2">
                <Label htmlFor="docker-url">Agent base URL</Label>
                <Input
                  id="docker-url"
                  value={dockerUrl}
                  onChange={(e) => setDockerUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docker-key">API key (optional)</Label>
                <Input
                  id="docker-key"
                  type="password"
                  value={dockerKey}
                  onChange={(e) => setDockerKey(e.target.value)}
                />
              </div>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const created = await addConnection({
                    data: {
                      name: "Docker local agent",
                      mode: "docker",
                      base_url: dockerUrl,
                      api_key: dockerKey || undefined,
                    },
                  });
                  const result = await health({ data: { id: created.id } });
                  setBusy(false);
                  invalidate();
                  result.healthy ? toast.success(result.message) : toast.warning(result.message);
                }}
              >
                Connect local agent
              </Button>
            </TabsContent>

            <TabsContent value="fly">
              <FlyDeployPanel onChanged={invalidate} />
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
