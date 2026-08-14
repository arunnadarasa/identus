import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, FileSignature, ShieldCheck, Coins } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/demos/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agentic demos — A2A, AP2, UCP, x402 | Identus Companion" },
      {
        name: "description",
        content:
          "Run live agent-to-agent commerce demos on Identus: A2A negotiation, AP2 mandates, UCP signed merchant responses and x402 USDC settlement on Base Sepolia.",
      },
      { property: "og:title", content: "Agentic demos — A2A, AP2, UCP, x402" },
      {
        property: "og:description",
        content:
          "Four live demos showing how verifiable credentials give AI agents identity, authority and payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemosHub,
});

const demos = [
  {
    to: "/app/demos/a2a",
    icon: Bot,
    title: "A2A negotiation",
    tag: "AIsa-powered",
    description:
      "Two agents discover each other, exchange an AP2 IntentMandate and CartMandate over JSON-RPC, and the seller demands a verifiable credential before discounting.",
    protocol: "A2A 0.3 · JSON-RPC message/send",
  },
  {
    to: "/app/demos/ap2",
    icon: FileSignature,
    title: "AP2 mandates",
    tag: "Wallet signature",
    description:
      "Sign the intent, cart and payment mandates as EIP-712 typed data with an embedded wallet, then recover the signer to prove the chain of authority.",
    protocol: "AP2 0.1 · EIP-712",
  },
  {
    to: "/app/demos/ucp",
    icon: ShieldCheck,
    title: "UCP conformance",
    tag: "RFC 9421",
    description:
      "Fetch the merchant manifest, catalog and a credential-gated quote, and verify every HTTP Message Signature against the merchant's published key.",
    protocol: "UCP 0.1 · ECDSA P-256",
  },
  {
    to: "/app/demos/x402",
    icon: Coins,
    title: "x402 settlement",
    tag: "Base Sepolia",
    description:
      "Take a real 402 challenge, sign an EIP-3009 USDC authorization in your wallet, and watch the facilitator settle it on-chain.",
    protocol: "x402 v2 · USDC testnet",
  },
] as const;

function DemosHub() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Agentic demos</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          An AI agent that can spend money needs three things a chat model does not have: a
          verifiable identity, a provable mandate from its human, and a way to pay. These four
          demos wire those onto Identus credentials, end to end, with real protocol messages on the
          wire.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {demos.map((d) => (
          <Card key={d.to} className="flex flex-col">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <d.icon className="h-5 w-5 shrink-0 text-primary" />
                <CardTitle className="text-base">{d.title}</CardTitle>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {d.tag}
                </Badge>
              </div>
              <CardDescription>{d.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <p className="font-mono text-[11px] text-muted-foreground">{d.protocol}</p>
              <Link
                to={d.to}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Run the demo <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How they fit together</CardTitle>
          <CardDescription>
            One purchase, four layers. A2A carries the conversation, AP2 carries the authority, UCP
            makes the merchant's answers verifiable, and x402 moves the money.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{`human ──delegation VC──▶ buyer agent
                          │  A2A: message/send
                          ▼
                     seller agent ──presentation request──▶ buyer agent
                          │                                    │
                          │◀────── JWT verifiable credential ──┘
                          │  AP2: CartMandate (signed)
                          ▼
                     UCP merchant (RFC 9421 signed responses)
                          │  x402: PAYMENT-SIGNATURE (EIP-3009)
                          ▼
                     facilitator ──settles USDC──▶ Base Sepolia`}</pre>
          <p className="mt-3 text-sm text-muted-foreground">
            New to the concepts? The{" "}
            <Link to="/learn" className="text-primary hover:underline">
              SSI explainer
            </Link>{" "}
            covers credentials and DIDs in plain English first.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
