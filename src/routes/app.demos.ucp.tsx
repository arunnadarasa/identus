import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ShieldCheck, X } from "lucide-react";

import { getAgenticIdentity, recordAgenticSession } from "@/lib/agentic/a2a.functions";
import { verifySignedResponse, type VerificationResult } from "@/lib/agentic/ucp-verify";
import { IdentityBanner } from "@/components/agentic/IdentityBanner";
import { JsonBlock } from "@/components/agentic/JsonBlock";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StickyActionBar } from "@/components/StickyActionBar";

export const Route = createFileRoute("/app/demos/ucp")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "UCP merchant conformance demo — Identus Companion" },
      {
        name: "description",
        content:
          "Fetch a UCP merchant manifest, catalog and credential-gated quote, and verify every RFC 9421 HTTP Message Signature against the merchant's published key.",
      },
      { property: "og:title", content: "UCP merchant conformance demo" },
      {
        property: "og:description",
        content: "RFC 9421 signature verification for agent-readable commerce endpoints.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UcpDemo,
});

type Probe = {
  name: string;
  method: string;
  url: string;
  status: number;
  body: unknown;
  bodyText: string;
  headers: Headers;
  verification: VerificationResult;
};

function UcpDemo() {
  const identityFn = useServerFn(getAgenticIdentity);
  const recordFn = useServerFn(recordAgenticSession);
  const { data: identity } = useQuery({ queryKey: ["agentic-identity"], queryFn: () => identityFn() });

  const [probes, setProbes] = useState<Probe[]>([]);
  const [busy, setBusy] = useState(false);
  const [tamperResult, setTamperResult] = useState<VerificationResult | null>(null);

  const runConformance = async () => {
    if (!identity) return;
    setBusy(true);
    setProbes([]);
    setTamperResult(null);
    const collected: Probe[] = [];
    let jwk: Record<string, unknown> | null = null;

    const probe = async (
      name: string,
      method: "GET" | "POST",
      path: string,
      body?: unknown,
    ): Promise<Probe> => {
      const url = `${window.location.origin}${path}`;
      const res = await fetch(url, {
        method,
        ...(body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
      const bodyText = await res.text();
      const parsed = (() => {
        try {
          return JSON.parse(bodyText);
        } catch {
          return bodyText;
        }
      })();
      if (name === "Manifest") {
        jwk = (parsed?.signing?.jwk ?? null) as Record<string, unknown> | null;
      }
      const verification = await verifySignedResponse({
        response: res,
        bodyText,
        method,
        targetUri: url,
        jwk,
      });
      const entry: Probe = {
        name,
        method,
        url,
        status: res.status,
        body: parsed,
        bodyText,
        headers: res.headers,
        verification,
      };
      collected.push(entry);
      setProbes([...collected]);
      return entry;
    };

    try {
      const manifest = await probe("Manifest", "GET", "/api/public/ucp-merchant?op=manifest");
      await probe("Catalog", "GET", "/api/public/ucp-merchant?op=catalog");
      const quote = await probe("Credential-gated quote", "POST", "/api/public/ucp-merchant", {
        op: "quote",
        sku: "identus-transcript-1y",
        quantity: 1,
        credentialJwt: identity.credentialJwt,
      });

      /* Tamper check: real signature headers, altered body — must fail. */
      const tampered = await verifySignedResponse({
        response: { headers: quote.headers, status: quote.status } as unknown as Response,
        bodyText: `${quote.bodyText} `,
        method: "POST",
        targetUri: quote.url,
        jwk,
      });
      setTamperResult(tampered);

      const allOk = collected.every((p) => p.verification.ok);
      await recordFn({
        data: {
          kind: "ucp",
          status: allOk ? "conformant" : "failed",
          simulated: identity.simulated,
          buyerDid: identity.buyerDid,
          sellerDid: identity.sellerDid,
          payload: {
            keyId: manifest.verification.keyId,
            results: collected.map((p) => ({ name: p.name, ok: p.verification.ok })),
            discountApplied: (quote.body as any)?.quote?.discountApplied ?? null,
          },
        },
      });
      if (allOk) toast.success("All merchant responses verified");
      else toast.warning("At least one response failed verification");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conformance run failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/demos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All demos
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" /> UCP conformance
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Agents buy from endpoints, not websites — so the endpoint has to be provably itself. This
          merchant signs every response with an ECDSA P-256 HTTP Message Signature (RFC 9421) and
          publishes its key in the manifest. Your browser re-derives the signature base and checks
          it, then requests a quote gated on a verifiable credential.
        </p>
      </div>

      <IdentityBanner identity={identity} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run the conformance suite</CardTitle>
          <CardDescription>
            Three signed calls — manifest, catalog, credential-gated quote — each verified against
            the key from the manifest, plus a tamper check that must fail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StickyActionBar>
            <Button onClick={runConformance} disabled={busy || !identity} className="w-full sm:w-auto">
              {busy ? "Probing merchant…" : "Verify merchant"}
            </Button>
          </StickyActionBar>
        </CardContent>
      </Card>

      {probes.map((p) => (
        <Card key={p.name}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{p.name}</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                {p.method} {p.status}
              </Badge>
              <Badge
                variant="outline"
                className={
                  p.verification.ok
                    ? "border-emerald-500/40 text-[10px] text-emerald-400"
                    : "border-destructive/40 text-[10px] text-destructive"
                }
              >
                {p.verification.ok ? "signature valid" : "unverified"}
              </Badge>
            </div>
            <CardDescription className="break-all font-mono text-[11px]">{p.url}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {p.verification.steps.map((s) => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  {s.ok ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    <span className="font-medium">{s.label}</span>{" "}
                    <span className="text-muted-foreground">— {s.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <JsonBlock value={p.verification.signatureBase} label="Signature base (reconstructed)" />
            <JsonBlock value={p.body} label="Response body" />
          </CardContent>
        </Card>
      ))}

      {tamperResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tamper check</CardTitle>
            <CardDescription>
              The same signature re-checked against a body with one extra byte. It must fail — that
              failure is what makes the other passes meaningful.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className={
                tamperResult.ok
                  ? "border-destructive/40 text-destructive"
                  : "border-emerald-500/40 text-emerald-400"
              }
            >
              {tamperResult.ok ? "unexpectedly valid" : "correctly rejected"}
            </Badge>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {tamperResult.steps.map((s) => (
                <li key={s.label} className="break-words [overflow-wrap:anywhere]">
                  {s.ok ? "✓" : "✕"} {s.label} — {s.detail}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
