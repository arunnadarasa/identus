import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileSignature, Wallet } from "lucide-react";

import {
  getAgenticIdentity,
  recordAgenticSession,
  verifyMandateSignature,
} from "@/lib/agentic/a2a.functions";
import { getAgenticConfig } from "@/lib/agentic/config.functions";
import { buildIntent, intentTypedData, paymentTypedData } from "@/lib/agentic/ap2";
import { jsonHash } from "@/lib/agentic/hash";
import { IdentityBanner } from "@/components/agentic/IdentityBanner";
import { JsonBlock } from "@/components/agentic/JsonBlock";
import { TranscriptView, type TranscriptStep } from "@/components/agentic/TranscriptView";
import { PrivyRoot } from "@/components/PrivyRoot";
import { useWalletSigner } from "@/lib/use-wallet-signer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StickyActionBar } from "@/components/StickyActionBar";

export const Route = createFileRoute("/app/demos/ap2")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AP2 mandate signing demo — Identus Companion" },
      {
        name: "description",
        content:
          "Sign AP2 intent and payment mandates as EIP-712 typed data with an embedded wallet, then recover the signer to prove an agent's delegated authority.",
      },
      { property: "og:title", content: "AP2 mandate signing demo" },
      {
        property: "og:description",
        content: "EIP-712 signed AP2 mandates, verified by signer recovery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ap2Page,
});

function Ap2Page() {
  const configFn = useServerFn(getAgenticConfig);
  const { data: config } = useQuery({ queryKey: ["agentic-config"], queryFn: () => configFn() });
  return (
    <PrivyRoot appId={config?.privyAppId ?? ""}>
      <Ap2Demo hasPrivy={Boolean(config?.privyAppId)} />
    </PrivyRoot>
  );
}

function Ap2Demo({ hasPrivy }: { hasPrivy: boolean }) {
  const identityFn = useServerFn(getAgenticIdentity);
  const verifyFn = useServerFn(verifyMandateSignature);
  const recordFn = useServerFn(recordAgenticSession);
  const wallet = useWalletSigner();

  const { data: identity } = useQuery({ queryKey: ["agentic-identity"], queryFn: () => identityFn() });

  const [maxPrice, setMaxPrice] = useState("9.00");
  const [steps, setSteps] = useState<TranscriptStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  const push = (entry: Omit<TranscriptStep, "step">) =>
    setSteps((prev) => [...prev, { step: prev.length + 1, ...entry }]);

  const runFlow = async () => {
    if (!identity) return;
    if (!wallet.signTypedData || !wallet.address) {
      toast.error("Connect a wallet first");
      return;
    }
    setBusy(true);
    setSteps([]);
    setQuote(null);
    try {
      /* 1. Intent mandate, signed by the human's wallet */
      const intent = buildIntent({
        buyerDid: identity.buyerDid,
        goal: "Delegated purchase of verified transcript access",
        sku: "identus-transcript-1y",
        quantity: 1,
        maxPrice,
        currency: "EUR",
        sellerDid: identity.sellerDid,
      });
      const intentTd = await intentTypedData(intent);
      const intentSig = await wallet.signTypedData(intentTd);
      const intentCheck = await verifyFn({
        data: { typedData: intentTd, signature: intentSig, expectedSigner: wallet.address },
      });
      push({
        label: "IntentMandate signed",
        actor: "human",
        detail: `Your wallet authorised a cap of ${maxPrice} EUR. The recovered signer ${
          intentCheck.matches ? "matches" : "does NOT match"
        } the connected address.`,
        values: [{ label: "signer", value: intentCheck.signer ?? "unknown" }],
        envelope: { intent, typedData: intentTd, signature: intentSig, verification: intentCheck },
      });

      /* 2. Merchant quote (RFC 9421 signed on the wire) */
      const quoteRes = await fetch("/api/public/ucp-merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "quote",
          sku: intent.sku,
          quantity: 1,
          credentialJwt: identity.credentialJwt,
        }),
      });
      const quoteBody = await quoteRes.json();
      setQuote(quoteBody);
      push({
        label: "Merchant quote received",
        actor: "seller",
        detail: `${quoteBody.quote.total} ${quoteBody.quote.currency}${
          quoteBody.quote.discountApplied ? " with the credential discount applied" : " at list price"
        }. Response carried an RFC 9421 signature (verified in the UCP demo).`,
        envelope: quoteBody,
      });

      const cart = {
        ap2Version: "0.1" as const,
        cartId: quoteBody.quote.quoteId,
        intentHash: await jsonHash(intent),
        sellerDid: identity.sellerDid,
        items: [
          {
            sku: quoteBody.quote.sku,
            name: quoteBody.quote.sku,
            quantity: quoteBody.quote.quantity,
            unitPrice: quoteBody.quote.unitPrice,
            currency: quoteBody.quote.currency,
          },
        ],
        total: { amount: quoteBody.quote.total, currency: quoteBody.quote.currency },
        expiresAt: quoteBody.quote.expiresAt,
      };

      const overCap = Number(cart.total.amount) > Number(maxPrice);
      if (overCap) {
        push({
          label: "Mandate exceeded — stopping",
          actor: "buyer",
          detail: `The quote of ${cart.total.amount} EUR is above the signed cap of ${maxPrice} EUR, so no PaymentMandate is produced.`,
          envelope: cart,
        });
        await recordFn({
          data: {
            kind: "ap2",
            status: "over-cap",
            simulated: identity.simulated,
            buyerDid: identity.buyerDid,
            sellerDid: identity.sellerDid,
            payload: { cart, maxPrice },
          },
        });
        return;
      }

      /* 3. Payment mandate bound to the cart hash */
      const paymentMandate = {
        ap2Version: "0.1" as const,
        paymentId: crypto.randomUUID(),
        cartHash: await jsonHash(cart),
        buyerDid: identity.buyerDid,
        amount: cart.total,
        settlement: { scheme: "x402-exact", network: "eip155:84532" },
      };
      const payTd = paymentTypedData(paymentMandate);
      const paySig = await wallet.signTypedData(payTd);
      const payCheck = await verifyFn({
        data: { typedData: payTd, signature: paySig, expectedSigner: wallet.address },
      });
      push({
        label: "PaymentMandate signed",
        actor: "buyer",
        detail: `The mandate is bound to the cart hash below — change one line item and this signature stops verifying. Recovery ${
          payCheck.matches ? "matched" : "failed"
        }.`,
        values: [{ label: "cart hash", value: paymentMandate.cartHash }],
        envelope: { paymentMandate, typedData: payTd, signature: paySig, verification: payCheck },
      });

      /* 4. Checkout at the merchant */
      const checkoutRes = await fetch("/api/public/ucp-merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "checkout",
          quoteId: quoteBody.quote.quoteId,
          paymentMandate: { ...paymentMandate, signature: paySig, signedBy: wallet.address },
        }),
      });
      const order = await checkoutRes.json();
      push({
        label: checkoutRes.ok ? "Order confirmed" : "Checkout rejected",
        actor: "seller",
        detail: checkoutRes.ok
          ? `Merchant accepted the mandate and confirmed order ${String(order.order?.orderId ?? "").slice(0, 8)}.`
          : `Merchant refused: ${order.error ?? checkoutRes.status}`,
        envelope: order,
      });

      await recordFn({
        data: {
          kind: "ap2",
          status: checkoutRes.ok ? "confirmed" : "rejected",
          simulated: identity.simulated,
          buyerDid: identity.buyerDid,
          sellerDid: identity.sellerDid,
          payload: { intent, cart, paymentMandate, order, signer: wallet.address },
        },
      });
      if (checkoutRes.ok) toast.success("Mandate chain signed and order confirmed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mandate signing failed");
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
          <FileSignature className="h-6 w-6 text-primary" /> AP2 mandates
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A mandate is the difference between an agent that acts and an agent that is allowed to act.
          Here your wallet signs an IntentMandate with a hard cap, the merchant quotes against a
          verifiable credential, and the PaymentMandate is cryptographically bound to that exact
          cart — anyone can recover the signer and check it.
        </p>
      </div>

      <IdentityBanner identity={identity} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Wallet</CardTitle>
            {wallet.address ? (
              <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-400">
                connected
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            An embedded wallet signs the mandates as EIP-712 typed data. Nothing is spent here —
            signing a mandate is free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasPrivy ? (
            <p className="text-sm text-destructive">
              Wallet sign-in is unavailable: no Privy app ID is configured for this project.
            </p>
          ) : wallet.address ? (
            <p className="break-all font-mono text-xs text-muted-foreground">{wallet.address}</p>
          ) : (
            <Button variant="outline" onClick={() => wallet.login()} disabled={!wallet.ready}>
              <Wallet className="mr-2 h-4 w-4" />
              {wallet.ready ? "Connect wallet" : "Loading wallet…"}
            </Button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ap2-cap">Signed spend cap (EUR)</Label>
              <Input
                id="ap2-cap"
                inputMode="decimal"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Set this below 8.00 to watch the agent refuse the merchant's best price.
              </p>
            </div>
          </div>
          <StickyActionBar>
            <Button
              onClick={runFlow}
              disabled={busy || !identity || !wallet.address}
              className="w-full sm:w-auto"
            >
              {busy ? "Signing…" : "Sign the mandate chain"}
            </Button>
          </StickyActionBar>
        </CardContent>
      </Card>

      {steps.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mandate chain</CardTitle>
            <CardDescription>
              Each signature covers a hash of the canonical JSON, so the wallet prompt stays readable
              while still binding the exact bytes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TranscriptView steps={steps} />
            {quote ? <JsonBlock value={quote.credentialCheck} label="Credential check by merchant" /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
