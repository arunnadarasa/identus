import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bot, Play, Sparkles } from "lucide-react";

import { getAgenticIdentity, runA2ANegotiation } from "@/lib/agentic/a2a.functions";
import { getAgenticConfig } from "@/lib/agentic/config.functions";
import { IdentityBanner } from "@/components/agentic/IdentityBanner";
import { TranscriptView, type TranscriptStep } from "@/components/agentic/TranscriptView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyActionBar } from "@/components/StickyActionBar";

export const Route = createFileRoute("/app/demos/a2a")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "A2A agent negotiation demo — Identus Companion" },
      {
        name: "description",
        content:
          "Watch two AI agents negotiate over A2A JSON-RPC, exchange AP2 mandates and gate a discount behind a verifiable credential presentation.",
      },
      { property: "og:title", content: "A2A agent negotiation demo" },
      {
        property: "og:description",
        content:
          "Real A2A JSON-RPC messages, AP2 mandates and a credential-gated discount, reasoned by AIsa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: A2ADemo,
});

const SKUS = [
  { sku: "identus-transcript-1y", label: "Verified transcript access (list 12.00 EUR)" },
  { sku: "identus-api-1k", label: "1,000 verification API calls (list 25.00 EUR)" },
];

function A2ADemo() {
  const identityFn = useServerFn(getAgenticIdentity);
  const configFn = useServerFn(getAgenticConfig);
  const negotiate = useServerFn(runA2ANegotiation);

  const { data: identity } = useQuery({ queryKey: ["agentic-identity"], queryFn: () => identityFn() });
  const { data: config } = useQuery({ queryKey: ["agentic-config"], queryFn: () => configFn() });

  const [sku, setSku] = useState(SKUS[0]!.sku);
  const [goal, setGoal] = useState("Get me a year of verified transcript access for under 10 euro.");
  const [maxPrice, setMaxPrice] = useState("9.00");
  const [withCredential, setWithCredential] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    transcript: TranscriptStep[];
    aisaLive: boolean;
    aisaNotes: string[];
    cart: any;
    payment: any;
  } | null>(null);

  const run = async () => {
    if (!identity) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await negotiate({
        data: {
          origin: window.location.origin,
          sku,
          goal,
          quantity: 1,
          maxPrice,
          currency: "EUR",
          buyerDid: identity.buyerDid,
          sellerDid: identity.sellerDid,
          credentialJwt: identity.credentialJwt ?? undefined,
          withCredential,
        },
      });
      setResult(res as any);
      if (res.status === "completed") toast.success("Negotiation settled and access granted");
      else if (res.status === "rejected") toast.warning("Seller ended the negotiation");
      else toast.info(`Negotiation ended in state: ${res.status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Negotiation failed");
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
          <Bot className="h-6 w-6 text-primary" /> A2A negotiation
          <Badge variant="outline" className="text-[10px]">
            {config?.aisaConfigured ? "AIsa live" : "AIsa key missing — scripted"}
          </Badge>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your buying agent discovers a seller agent's A2A card, sends an AP2 IntentMandate with a
          hard spend cap, and is asked to prove eligibility before the seller will price below list.
          The credential is the only reason the discount happens — every message below is a real
          JSON-RPC round trip to <span className="font-mono text-[11px]">/api/public/a2a-seller</span>.
        </p>
      </div>

      <IdentityBanner identity={identity} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mandate from your human</CardTitle>
          <CardDescription>
            The cap is enforced by the agent, not the seller: anything above it is refused even if
            the seller offers it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="a2a-sku">What to buy</Label>
              <Select value={sku} onValueChange={setSku}>
                <SelectTrigger id="a2a-sku">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKUS.map((s) => (
                    <SelectItem key={s.sku} value={s.sku}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a2a-max">Spend cap (EUR)</Label>
              <Input
                id="a2a-max"
                inputMode="decimal"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="a2a-goal">Instruction</Label>
            <Input id="a2a-goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-md border border-border/70 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Present eligibility credential</p>
              <p className="text-xs text-muted-foreground">
                Turn this off to see the negotiation stall: without a {identity?.credentialType} the
                seller will not go below list price.
              </p>
            </div>
            <Switch checked={withCredential} onCheckedChange={setWithCredential} />
          </div>
          <StickyActionBar>
            <Button onClick={run} disabled={busy || !identity} className="w-full sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              {busy ? "Negotiating…" : "Run negotiation"}
            </Button>
          </StickyActionBar>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Transcript</CardTitle>
              <Badge
                variant="outline"
                className={
                  result.status === "completed"
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-amber-500/40 text-amber-400"
                }
              >
                {result.status}
              </Badge>
              {result.aisaLive ? (
                <Badge variant="outline" className="text-[10px]">
                  <Sparkles className="mr-1 h-3 w-3" /> AIsa reasoning
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              {result.cart
                ? `Final quote: ${result.cart.total.amount} ${result.cart.total.currency}.`
                : "No cart was agreed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.aisaNotes?.length ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-300">
                {result.aisaNotes.join(" · ")}
              </p>
            ) : null}
            <TranscriptView steps={result.transcript} />
            {result.status === "completed" ? (
              <p className="text-sm text-muted-foreground">
                Next:{" "}
                <Link to="/app/demos/x402" className="text-primary hover:underline">
                  settle a payment for real on Base Sepolia
                </Link>
                .
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
