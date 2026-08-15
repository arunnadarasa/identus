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
  listAgentConnections,
  listIssuerDids,
} from "@/lib/identus.functions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TruncatedMono, shortenId } from "@/components/MonoValue";


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
  const fetchAgentConnections = useServerFn(listAgentConnections);
  const fetchIssuerDids = useServerFn(listIssuerDids);

  const { data } = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const { data: agentConns, isLoading: connsLoading } = useQuery({
    queryKey: ["agent-didcomm-connections"],
    queryFn: () => fetchAgentConnections(),
  });
  const { data: issuerData, isLoading: issuerLoading } = useQuery({
    queryKey: ["agent-issuer-dids"],
    queryFn: () => fetchIssuerDids(),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const dids = (data?.dids ?? []) as any[];
  const schemas = (data?.schemas ?? []) as any[];
  const isRealAgent = (data?.active?.mode ?? "simulated") !== "simulated";
  const didcomm = (agentConns?.connections ?? []) as any[];
  const issuerOptions = (issuerData?.dids ?? []) as Array<{ did: string; alias: string }>;


  const [issuerDid, setIssuerDid] = useState("");
  const [holderDid, setHolderDid] = useState("");
  const [target, setTarget] = useState("");
  const [subject, setSubject] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [claimsText, setClaimsText] = useState(
    '{\n  "degree": "BSc Computer Science",\n  "year": "2026",\n  "dob": "1998-04-12"\n}',
  );
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

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">Issue a credential</CardTitle>
            <CardDescription>JWT format, signed by the issuing DID.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRealAgent ? (
              <div className="space-y-2">
                <Label>Send over connection</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue
                      placeholder={
                        connsLoading ? "Loading connections…" : "Select a DIDComm connection"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connectionless">Connectionless (invitation)</SelectItem>
                    {didcomm.map((c) => (
                      <SelectItem key={c.connectionId} value={c.connectionId}>
                        {c.label} · {c.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!connsLoading && didcomm.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No DIDComm connections yet — send a connectionless invitation instead.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Issuer DID</Label>
              <Select value={issuerDid} onValueChange={setIssuerDid}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue
                    placeholder={issuerLoading ? "Loading agent DIDs…" : "Select an issuer DID"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {issuerOptions.map((did) => (
                    <SelectItem key={did.did} value={did.did}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="font-mono text-xs">
                          {did.alias.startsWith("did:") ? shortenId(did.alias, 6, 6) : did.alias}
                        </span>
                        {"keys" in did && (did as { keys?: string[] }).keys?.length ? (
                          <span className="text-[10px] text-muted-foreground">
                            can sign · {(did as { keys: string[] }).keys.join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isRealAgent && !issuerLoading && issuerOptions.length === 0 ? (
                (issuerData?.reason ?? "no_dids") === "publishing" ? (
                  <p className="text-xs text-muted-foreground">
                    Your issuer DID is still publishing — the DIDs page shows live status.
                  </p>
                ) : (issuerData?.reason ?? "") === "no_assertion_key" ? (
                  <p className="text-xs text-destructive">
                    No assertion key on this agent&apos;s DIDs — create a new Issuer DID.
                  </p>
                ) : (issuerData?.reason ?? "") === "error" ? (
                  <p className="text-xs text-destructive">
                    Could not read DIDs from the agent{issuerData?.error ? `: ${issuerData.error}` : "."}
                  </p>
                ) : (
                  <p className="text-xs text-destructive">
                    No DIDs on this agent yet — create an Issuer DID on the DIDs page.
                  </p>
                )
              ) : null}

              {isRealAgent && issuerOptions.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Published DIDs owned by the connected agent that hold an assertionMethod key.
                </p>
              ) : null}

              {isRealAgent && (issuerData?.excluded?.length ?? 0) > 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Not listed as issuers</p>
                  <ul className="mt-1 space-y-0.5">
                    {(issuerData?.excluded ?? []).map((item) => (
                      <li key={item.did} className="break-all">
                        <span className="font-mono">
                          {item.alias.startsWith("did:") ? shortenId(item.alias, 6, 6) : item.alias}
                        </span>{" "}
                        — {item.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">
                    Credentials must be signed with an assertionMethod key. Create an Issuer DID on
                    the DIDs page if none of your DIDs can sign.
                  </p>
                </div>
              ) : null}
            </div>
            {!isRealAgent || target !== "connectionless" ? (
              <div className="space-y-2">
                <Label>Holder DID</Label>
                <Select value={holderDid} onValueChange={setHolderDid}>
                  <SelectTrigger className="h-11 sm:h-10">
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
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="subject">Subject name</Label>
              <Input
                id="subject"
                className="h-11 sm:h-10"
                placeholder="Ada Lovelace"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Schema</Label>
              <Select value={schemaName} onValueChange={setSchemaName}>
                <SelectTrigger className="h-11 sm:h-10">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    setClaimsText(
                      '{\n  "name": "Alice Holder",\n  "dob": "1998-04-12",\n  "idNumber": "AB-1029"\n}',
                    )
                  }
                >
                  Age-provable ID template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    // Merge a dob into whatever valid JSON is already typed.
                    try {
                      const parsed = JSON.parse(claimsText);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        setClaimsText(
                          JSON.stringify({ ...parsed, dob: "1998-04-12" }, null, 2),
                        );
                        return;
                      }
                    } catch {
                      // fall through to a clean template
                    }
                    setClaimsText('{\n  "dob": "1998-04-12"\n}');
                  }}
                >
                  Add dob claim
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A <span className="font-mono">dob</span> claim makes the credential usable by
                the zero-knowledge age proof.
              </p>
              <Textarea
                id="claims"
                rows={5}
                className="w-full max-w-full overflow-x-auto whitespace-pre font-mono text-xs"
                value={claimsText}
                onChange={(e) => setClaimsText(e.target.value)}
              />
            </div>

            <StickyActionBar>
            <Button
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={
                busy ||
                !issuerDid ||
                (!holderDid && !(isRealAgent && target === "connectionless")) ||
                !subject ||
                !schemaName ||
                (isRealAgent && !target) ||
                (isRealAgent && !issuerLoading && issuerOptions.length === 0)
              }
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
                    data: {
                      issuerDid,
                      ...(holderDid ? { holderDid } : {}),

                      subject,
                      schemaName,
                      claims,
                      ...(isRealAgent && target !== "connectionless"
                        ? { connectionId: target }
                        : {}),
                      ...(isRealAgent && target === "connectionless"
                        ? { connectionless: true }
                        : {}),
                    },
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
            </StickyActionBar>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">Credential schemas</CardTitle>
            <CardDescription>Versioned attribute sets for your credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schema-title">Name</Label>
              <Input
                id="schema-title"
                className="h-11 sm:h-10"
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
                  className="h-11 sm:h-10"
                  value={schemaVersion}
                  onChange={(e) => setSchemaVersion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schema-attrs">Attributes</Label>
                <Input
                  id="schema-attrs"
                  className="h-11 sm:h-10"
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

      <Card className="min-w-0 border-border/60">
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
                className="min-w-0 space-y-3 border-b border-border/50 pb-4 last:border-0"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {record.schema_name} · {record.subject}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {record.protocol_state}
                    </Badge>
                    {record.verified ? (
                      <Badge className="bg-success text-success-foreground text-[11px]">
                        verified
                      </Badge>
                    ) : null}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {shortenId(record.record_id, 6, 4)}
                    </span>
                  </div>
                </div>

                {Object.keys(record.claims ?? {}).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(record.claims ?? {}).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-secondary/50 px-2 py-1 text-[11px]"
                      >
                        <span className="text-muted-foreground">{k}</span>
                        <span className="min-w-0 truncate">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {record.protocol_state !== "CredentialReceived" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 w-full sm:h-9 sm:w-auto"
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
                      className="h-11 w-full sm:h-9 sm:w-auto"
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

                {record.jwt ? <TruncatedMono label="Credential JWT" value={record.jwt} /> : null}
                {record.invitation_url ? (
                  <TruncatedMono label="Invitation URL" value={record.invitation_url} />
                ) : null}
              </div>
            ))

          )}
        </CardContent>
      </Card>
    </div>
  );
}
