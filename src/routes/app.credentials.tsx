import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getWorkspace,
  issueCredential,
  acceptCredential,
  verifyCredential,
  createSchema,
} from "@/lib/identus.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/credentials")({
  ssr: false,
  component: Credentials,
});

function Credentials() {
  const qc = useQueryClient();
  const fetchWorkspace = useServerFn(getWorkspace);
  const issue = useServerFn(issueCredential);
  const accept = useServerFn(acceptCredential);
  const verify = useServerFn(verifyCredential);
  const addSchema = useServerFn(createSchema);

  const { data } = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const dids = (data?.dids ?? []) as any[];
  const schemas = (data?.schemas ?? []) as any[];

  const [issuerDid, setIssuerDid] = useState("");
  const [holderDid, setHolderDid] = useState("");
  const [subject, setSubject] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [claimsText, setClaimsText] = useState('{\n  "degree": "BSc Computer Science",\n  "year": "2026"\n}');
  const [schemaTitle, setSchemaTitle] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("1.0.0");
  const [schemaAttrs, setSchemaAttrs] = useState("degree, year");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          Verifiable credentials
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offer a credential, accept it into the holder wallet, then run a verification.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">Issue a credential</CardTitle>
            <CardDescription>JWT format, signed by the issuing DID.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Issuer DID</Label>
              <Select value={issuerDid} onValueChange={setIssuerDid}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an issuer DID" />
                </SelectTrigger>
                <SelectContent>
                  {dids.map((did) => (
                    <SelectItem key={did.id} value={did.did}>
                      {did.alias} · {did.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Holder DID</Label>
              <Select value={holderDid} onValueChange={setHolderDid}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a holder DID" />
                </SelectTrigger>
                <SelectContent>
                  {dids.map((did) => (
                    <SelectItem key={`h-${did.id}`} value={did.did}>
                      {did.alias} · {did.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject name</Label>
              <Input
                id="subject"
                placeholder="Ada Lovelace"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Schema</Label>
              <Select value={schemaName} onValueChange={setSchemaName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a schema" />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((schema) => (
                    <SelectItem key={schema.id} value={schema.name}>
                      {schema.name}@{schema.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="claims">Claims (JSON)</Label>
              <Textarea
                id="claims"
                rows={5}
                className="font-mono text-xs"
                value={claimsText}
                onChange={(e) => setClaimsText(e.target.value)}
              />
            </div>
            <Button
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={busy || !issuerDid || !holderDid || !subject || !schemaName}
              onClick={async () => {
                let claims: Record<string, string>;
                try {
                  const parsed = JSON.parse(claimsText);
                  claims = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [k, String(v)]),
                  );
                } catch {
                  toast.error("Claims must be valid JSON");
                  return;
                }
                setBusy(true);
                try {
                  await issue({
                    data: { issuerDid, holderDid, subject, schemaName, claims },
                  });
                  invalidate();
                  toast.success("Credential offered");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Issuance failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Offer credential
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">Credential schemas</CardTitle>
            <CardDescription>Versioned attribute sets for your credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schema-title">Name</Label>
              <Input
                id="schema-title"
                placeholder="UniversityDegree"
                value={schemaTitle}
                onChange={(e) => setSchemaTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schema-version">Version</Label>
                <Input
                  id="schema-version"
                  value={schemaVersion}
                  onChange={(e) => setSchemaVersion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schema-attrs">Attributes</Label>
                <Input
                  id="schema-attrs"
                  value={schemaAttrs}
                  onChange={(e) => setSchemaAttrs(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={busy || !schemaTitle}
              onClick={async () => {
                setBusy(true);
                try {
                  await addSchema({
                    data: {
                      name: schemaTitle,
                      version: schemaVersion,
                      attributes: schemaAttrs
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean),
                    },
                  });
                  setSchemaTitle("");
                  invalidate();
                  toast.success("Schema created");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not create schema");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Add schema
            </Button>
            <div className="space-y-2 pt-2">
              {schemas.map((schema) => (
                <div key={schema.id} className="font-mono text-xs text-muted-foreground">
                  {schema.name}@{schema.version} — {(schema.attributes ?? []).join(", ")}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Credential records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data?.credentials ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No credentials yet.</p>
          ) : (
            (data?.credentials ?? []).map((record: any) => (
              <div
                key={record.id}
                className="space-y-2 border-b border-border/50 pb-4 last:border-0"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {record.schema_name} · {record.subject}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {record.record_id} · {record.protocol_state}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {record.verified ? (
                      <Badge className="bg-success text-success-foreground text-xs">verified</Badge>
                    ) : null}
                    {record.protocol_state !== "CredentialReceived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await accept({ data: { id: record.id } });
                          invalidate();
                          toast.success("Credential stored in the holder wallet");
                        }}
                      >
                        Accept
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const result = await verify({ data: { id: record.id } });
                          invalidate();
                          const failed = result.checks.filter((c) => !c.ok);
                          result.verified
                            ? toast.success("Presentation verified — all checks passed")
                            : toast.error(
                                `Verification failed: ${failed.map((c) => c.name).join(", ")}`,
                              );
                        }}
                      >
                        Verify
                      </Button>
                    )}
                  </div>
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {Object.entries(record.claims ?? {})
                    .map(([k, v]) => `${k}=${v}`)
                    .join("  ")}
                </p>
                {record.jwt ? (
                  <p className="break-all rounded-md bg-secondary/40 p-2 font-mono text-[11px] text-muted-foreground">
                    {record.jwt.slice(0, 220)}…
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
