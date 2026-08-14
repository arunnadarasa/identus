import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getWorkspace,
  createDid,
  createPeerConnection,
  acceptPeerConnection,
  publishDid,
  refreshDidStatuses,
} from "@/lib/identus.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/dids")({
  ssr: false,
  component: Dids,
});

function Dids() {
  const qc = useQueryClient();
  const fetchWorkspace = useServerFn(getWorkspace);
  const addDid = useServerFn(createDid);
  const addPeer = useServerFn(createPeerConnection);
  const acceptPeer = useServerFn(acceptPeerConnection);
  const publish = useServerFn(publishDid);
  const refreshStatuses = useServerFn(refreshDidStatuses);

  const { data } = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const [alias, setAlias] = useState("");
  const [role, setRole] = useState<"issuer" | "holder" | "verifier">("issuer");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const activeConnectionId = (data?.active?.id ?? null) as string | null;
  const isRealAgent = (data?.active?.mode ?? "simulated") !== "simulated";
  const allDids = (data?.dids ?? []) as any[];
  const pendingCount = allDids.filter(
    (d) => d.connection_id === activeConnectionId && d.status !== "PUBLISHED" && d.role !== "holder",
  ).length;

  // Publication is asynchronous on a real agent, so poll while anything is pending.
  useEffect(() => {
    if (!isRealAgent || pendingCount === 0) return;
    const timer = setInterval(async () => {
      try {
        const res = await refreshStatuses();
        if (res?.updated) {
          invalidate();
          qc.invalidateQueries({ queryKey: ["agent-issuer-dids"] });
        }
      } catch {
        // ignore transient agent errors while polling
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [isRealAgent, pendingCount]);


  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          DIDs & DIDComm connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create decentralised identifiers and establish peer connections through out-of-band
          invitations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">Create a DID</CardTitle>
            <CardDescription>
              Registers a did:prism identifier with the active agent's DID registrar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alias">Alias</Label>
              <Input
                id="alias"
                placeholder="Acme University"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="issuer">Issuer</SelectItem>
                  <SelectItem value="holder">Holder</SelectItem>
                  <SelectItem value="verifier">Verifier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={busy || !alias}
              onClick={async () => {
                setBusy(true);
                try {
                  await addDid({ data: { alias, role } });
                  setAlias("");
                  invalidate();
                  toast.success("DID created");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not create the DID");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create DID
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">New DIDComm invitation</CardTitle>
            <CardDescription>
              Generates an out-of-band invitation another agent can accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Connection label</Label>
              <Input
                id="label"
                placeholder="Student wallet"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <Button
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={busy || !label}
              onClick={async () => {
                setBusy(true);
                try {
                  await addPeer({ data: { label } });
                  setLabel("");
                  invalidate();
                  toast.success("Invitation created");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not create the invitation",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create invitation
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Your DIDs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allDids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No DIDs yet.</p>
          ) : (
            allDids.map((did: any) => {
              const onThisAgent = did.connection_id === activeConnectionId;
              const isDemo = isRealAgent && !onThisAgent;
              const pending = onThisAgent && isRealAgent && did.status !== "PUBLISHED";
              return (
                <div
                  key={did.id}
                  className="flex flex-col gap-2 border-b border-border/50 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{did.alias}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{did.did}</p>
                    {isDemo ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Simulated-only demo DID — the connected agent does not own it.
                      </p>
                    ) : null}
                    {pending ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Publishing on the agent — this can take a few minutes.
                      </p>
                    ) : null}
                    {did.publish_error ? (
                      <p className="mt-1 text-xs text-destructive">{did.publish_error}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {did.role}
                    </Badge>
                    <Badge variant={isDemo ? "secondary" : "outline"} className="text-xs">
                      {isDemo ? "demo" : did.status}
                    </Badge>
                    {onThisAgent && isRealAgent && did.status !== "PUBLISHED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await publish({ data: { id: did.id } });
                            invalidate();
                            qc.invalidateQueries({ queryKey: ["agent-issuer-dids"] });
                            toast.success("Publication requested");
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "Could not publish the DID",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Publish
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })

          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.peers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No connections yet.</p>
          ) : (
            (data?.peers ?? []).map((peer: any) => (
              <div
                key={peer.id}
                className="space-y-2 border-b border-border/50 pb-3 last:border-0"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{peer.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{peer.state}</p>
                  </div>
                  {peer.state !== "ConnectionResponseSent" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await acceptPeer({ data: { id: peer.id } });
                        invalidate();
                        toast.success("Connection established");
                      }}
                    >
                      Accept as peer
                    </Button>
                  ) : (
                    <Badge className="text-xs">connected</Badge>
                  )}
                </div>
                {peer.invitation_url ? (
                  <p className="break-all rounded-md bg-secondary/40 p-2 font-mono text-[11px] text-muted-foreground">
                    {peer.invitation_url}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
