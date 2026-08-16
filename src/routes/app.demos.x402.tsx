import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Coins,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import { getAgenticIdentity, recordAgenticSession } from "@/lib/agentic/a2a.functions";
import { getAgenticConfig } from "@/lib/agentic/config.functions";
import { issueX402Mandate } from "@/lib/agentic/x402.functions";
import {
  authorizationTypedData,
  buildPaymentHeader,
  fetchChallenge,
  fetchPaid,
  formatUsdc,
  pickRequirement,
  x402Cfg,
  type PaymentRequirement,
} from "@/lib/agentic/x402";
import {
  DELEGATION_CREDENTIAL_TYPE,
  PAYMENT_SCOPE,
  PRICE_TIERS,
  REQUIRED_CREDENTIAL_TYPE,
  inspectCredential,
} from "@/lib/agentic/x402-mandate";
import { PrivyRoot } from "@/components/PrivyRoot";
import { useWalletSigner } from "@/lib/use-wallet-signer";
import { TranscriptView, type TranscriptStep } from "@/components/agentic/TranscriptView";
import { TruncatedMono } from "@/components/MonoValue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StickyActionBar } from "@/components/StickyActionBar";

export const Route = createFileRoute("/app/demos/x402")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "x402 settlement with Identus delegation — Identus Companion" },
      {
        name: "description",
        content:
          "An Identus credential unlocks the member price, a delegation mandate authorises the spend, then an EIP-3009 USDC authorization settles on Base Sepolia.",
      },
      { property: "og:title", content: "x402 settlement with Identus delegation" },
      {
        property: "og:description",
        content:
          "Credential-gated pricing and delegation-bound agent payments, settled in testnet USDC on Base Sepolia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: X402Page,
});

function X402Page() {
  const configFn = useServerFn(getAgenticConfig);
  const { data: config } = useQuery({ queryKey: ["agentic-config"], queryFn: () => configFn() });
  return (
    <PrivyRoot appId={config?.privyAppId ?? ""}>
      <X402Demo hasPrivy={Boolean(config?.privyAppId)} />
    </PrivyRoot>
  );
}

const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type Tamper = "none" | "no-credential" | "low-cap" | "wrong-principal";

function X402Demo({ hasPrivy }: { hasPrivy: boolean }) {
  const wallet = useWalletSigner();
  const recordFn = useServerFn(recordAgenticSession);
  const identityFn = useServerFn(getAgenticIdentity);
  const mandateFn = useServerFn(issueX402Mandate);

  const { data: identity } = useQuery({
    queryKey: ["agentic-identity"],
    queryFn: () => identityFn(),
  });

  const [steps, setSteps] = useState<TranscriptStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<PaymentRequirement | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mandateJwt, setMandateJwt] = useState<string | null>(null);

  const [agentName, setAgentName] = useState("Shopping agent");
  const [spendLimit, setSpendLimit] = useState("0.50");
  const [validMinutes, setValidMinutes] = useState("60");
  const [paymentScope, setPaymentScope] = useState(true);

  const push = (entry: Omit<TranscriptStep, "step">) =>
    setSteps((prev) => [...prev, { step: prev.length + 1, ...entry }]);

  const refreshBalance = async () => {
    if (!wallet.address) return;
    try {
      const { createPublicClient, http, formatUnits } = await import("viem");
      const { baseSepolia } = await import("viem/chains");
      const client = createPublicClient({ chain: baseSepolia, transport: http(x402Cfg.rpcUrl) });
      const raw = await client.readContract({
        address: x402Cfg.usdcAddress as `0x${string}`,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [wallet.address],
      });
      setBalance(formatUnits(raw as bigint, 6));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read USDC balance");
    }
  };

  const run = async (tamper: Tamper = "none") => {
    if (!wallet.signTypedData || !wallet.address) {
      toast.error("Connect a wallet first");
      return;
    }
    setBusy(true);
    setSteps([]);
    setTxHash(null);
    setMandateJwt(null);
    try {
      /* 1. Challenge with no credential — the gate asks for one */
      const anon = await fetchChallenge();
      push({
        label: "HTTP 402 — credential required",
        actor: "seller",
        detail:
          anon.gate?.reason ??
          `The Identus gate answered ${anon.status} and asked for a ${REQUIRED_CREDENTIAL_TYPE}.`,
        state: "input-required",
        envelope: { status: anon.status, identus: anon.gate, accepts: anon.challenge?.accepts },
      });

      if (tamper === "no-credential") {
        const req = pickRequirement(anon.challenge);
        if (!req) throw new Error("The 402 listed no usable payment requirement.");
        const { typedData, authorization } = authorizationTypedData({
          requirement: req,
          from: wallet.address,
        });
        const signature = await wallet.signTypedData(typedData);
        const { header } = buildPaymentHeader({ requirement: req, authorization, signature });
        const blocked = await fetchPaid(header);
        push({
          label: "Gate refused the payment",
          actor: "verifier",
          detail:
            blocked.gate?.reason ??
            `HTTP ${blocked.status} — no credential, so nothing reached the facilitator.`,
          state: "rejected",
          envelope: { status: blocked.status, identus: blocked.gate, body: blocked.body.slice(0, 600) },
        });
        toast.message("Blocked before settlement — no credential presented");
        return;
      }

      /* 2. Present the eligibility credential — member price */
      const credentialJwt = identity?.credentialJwt ?? null;
      if (!credentialJwt) throw new Error("No eligibility credential available for this account.");
      const verified = await fetchChallenge({ credentialJwt });
      const req = pickRequirement(verified.challenge);
      setRequirement(req);
      if (!req) throw new Error(`The 402 listed no "exact" requirement on ${x402Cfg.network}.`);
      push({
        label: `${identity?.credentialType ?? REQUIRED_CREDENTIAL_TYPE} presented`,
        actor: "buyer",
        detail:
          verified.gate?.reason ??
          "Credential accepted — the gate re-quoted at the member tier.",
        simulated: identity?.simulated ?? true,
        envelope: {
          identus: verified.gate,
          tierQuote: `${verified.gate?.quote ?? PRICE_TIERS.member} ${PRICE_TIERS.currency}`,
          settledAmount: `${formatUsdc(req.amount)} USDC (set by the facilitator)`,
        },
      });

      /* 3. Delegation mandate — acts for whoever presented the credential */
      const cap = tamper === "low-cap" ? "0.000001" : spendLimit;
      const credentialSubject = inspectCredential(credentialJwt).subject;
      const principalDid =
        tamper === "wrong-principal"
          ? "did:prism:someone-else-0000000000000000000000000000"
          : (credentialSubject ?? undefined);
      const mandate = await mandateFn({
        data: {
          agentName,
          spendLimit: cap,
          validMinutes: Math.max(1, Number(validMinutes) || 60),
          payerWallet: wallet.address,
          allowedMerchants: [req.payTo],
          includePaymentScope: paymentScope,
          ...(principalDid ? { principalDid } : {}),
        },
      });
      setMandateJwt(mandate.jwt);
      push({
        label: `${DELEGATION_CREDENTIAL_TYPE} issued`,
        actor: "human",
        detail: `${mandate.claims.agentName} may spend up to ${cap} ${PRICE_TIERS.currency} on behalf of its principal, scope [${mandate.claims.scope.join(", ")}], until ${new Date(mandate.validUntil).toLocaleTimeString()}.${
          mandate.agentDidIsPlaceholder
            ? " The agent DID is a demo placeholder — create a DID with \u201Cagent\u201D in its alias on the DIDs page to bind a real one."
            : ""
        }`,
        simulated: mandate.simulated,
        envelope: {
          roles: {
            issuedBy: mandate.issuerDid,
            issuedToAgent: mandate.agentDid,
            actsForHuman: mandate.humanDid,
            credentialPresentedBy: credentialSubject,
          },
          claims: mandate.claims,
        },
      });

      /* 4. Sign the EIP-3009 authorization */
      const { typedData, authorization } = authorizationTypedData({
        requirement: req,
        from: wallet.address,
      });
      const signature = await wallet.signTypedData(typedData);
      const { header, envelope } = buildPaymentHeader({
        requirement: req,
        authorization,
        signature,
      });
      push({
        label: "EIP-3009 authorization signed",
        actor: "buyer",
        detail:
          "The wallet signed a transfer authorization — no gas, no on-chain transaction yet. The gate checks the mandate before the facilitator sees it.",
        envelope,
      });

      /* 5. Retry with credential + mandate — gate verifies coverage */
      const paid = await fetchPaid(header, {
        credentialJwt,
        delegationJwt: mandate.jwt,
        agentDid: mandate.agentDid,
      });
      if (paid.status !== 200) {
        const blockedByGate = paid.status === 403 || paid.status === 402;
        push({
          label: blockedByGate ? "Identus gate rejected the payment" : "Facilitator rejected the payment",
          actor: "verifier",
          detail:
            paid.gate?.reason ??
            `HTTP ${paid.status}. The response body is shown verbatim — it is the only signal here.`,
          state: "rejected",
          envelope: { status: paid.status, identus: paid.gate, body: paid.body.slice(0, 1000) },
        });
        await recordFn({
          data: {
            kind: "x402",
            status: `rejected-${paid.status}`,
            simulated: false,
            payload: {
              body: paid.body.slice(0, 1000),
              requirement: req,
              gate: paid.gate ?? null,
            },
          },
        });
        toast.error(blockedByGate ? "Blocked by the delegation mandate" : "Payment was not accepted");
        return;
      }

      push({
        label: "Mandate covers the payment",
        actor: "verifier",
        detail: `Credential and mandate both check out, so the gate forwarded the authorization for ${formatUsdc(req.amount)} USDC to the facilitator.`,
        state: "working",
        envelope: { scope: PAYMENT_SCOPE, cap: `${cap} ${PRICE_TIERS.currency}`, payTo: req.payTo },
      });

      /* 6. Settlement */
      const hash = paid.receipt?.transaction ?? null;
      setTxHash(hash);
      push({
        label: "Settled on-chain",
        actor: "verifier",
        detail: hash
          ? `Facilitator settled the transfer on ${paid.receipt?.network ?? x402Cfg.chainName}.`
          : "Resource unlocked, but the facilitator returned no transaction hash.",
        values: hash ? [{ label: "tx", value: hash }] : undefined,
        state: "completed",
        envelope: { receipt: paid.receipt, body: paid.body.slice(0, 600) },
      });

      await recordFn({
        data: {
          kind: "x402",
          status: "settled",
          simulated: false,
          txHash: hash ?? undefined,
          buyerDid: mandate.agentDid,
          payload: {
            receipt: paid.receipt ?? null,
            requirement: req,
            payer: wallet.address,
            mandate: mandate.claims,
          },
        },
      });
      toast.success("Payment settled and content unlocked");
      void refreshBalance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "x402 flow failed");
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
          <Coins className="h-6 w-6 text-primary" /> x402 settlement
          <Badge variant="outline" className="text-[10px]">
            {x402Cfg.chainName}
          </Badge>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          x402 answers <em>can this agent pay</em>. Identus answers <em>who is it, and who
          authorised it</em>. Here both halves join up: an eligibility credential unlocks the member
          price, a delegation mandate bounds the spend, and only a covered payment reaches the
          facilitator for real settlement on Base Sepolia.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-4 w-4 text-primary" /> How the two protocols split
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The gate in front of the facilitator quotes {PRICE_TIERS.list} {PRICE_TIERS.currency}{" "}
            without a credential and {PRICE_TIERS.member} {PRICE_TIERS.currency} with one. Those
            tiers are the gate's own policy — the amount actually settled on-chain is fixed by the
            testnet facilitator's requirement, so the chain never sees the discount.
          </p>
          <p>
            Credential-gated pricing and mandate-bound spending are also what drive the{" "}
            <Link to="/app/demos/ap2" className="text-primary hover:underline">
              AP2
            </Link>{" "}
            and{" "}
            <Link to="/app/demos/ucp" className="text-primary hover:underline">
              UCP
            </Link>{" "}
            demos;{" "}
            <Link to="/learn" className="text-primary hover:underline">
              /learn
            </Link>{" "}
            walks the delegation chain step by step.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet and funding</CardTitle>
          <CardDescription>
            Testnet USDC only. Get some from the Circle faucet (choose Base Sepolia), then refresh —
            arrival takes roughly ten seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasPrivy ? (
            <p className="text-sm text-destructive">
              Wallet sign-in is unavailable: no Privy app ID is configured for this project.
            </p>
          ) : wallet.address ? (
            <>
              <p className="break-all font-mono text-xs text-muted-foreground">{wallet.address}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {balance === null ? "balance unknown" : `${balance} USDC`}
                </Badge>
                <Button variant="outline" size="sm" onClick={refreshBalance}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh balance
                </Button>
                <a
                  href={x402Cfg.faucetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Circle faucet <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={() => wallet.login()} disabled={!wallet.ready}>
              <Wallet className="mr-2 h-4 w-4" />
              {wallet.ready ? "Connect wallet" : "Loading wallet…"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delegation mandate</CardTitle>
          <CardDescription>
            Issued as a {DELEGATION_CREDENTIAL_TYPE} before the payment. The gate checks subject,
            scope <code className="font-mono text-[11px]">{PAYMENT_SCOPE}</code>, spend cap, merchant
            and expiry — anything outside the mandate is rejected before the facilitator sees it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spend-cap">Spend cap ({PRICE_TIERS.currency})</Label>
              <Input
                id="spend-cap"
                inputMode="decimal"
                value={spendLimit}
                onChange={(e) => setSpendLimit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valid-minutes">Valid for (minutes)</Label>
              <Input
                id="valid-minutes"
                inputMode="numeric"
                value={validMinutes}
                onChange={(e) => setValidMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Grant the payment scope</p>
              <p className="text-xs text-muted-foreground">
                Turn this off to see the gate reject with <code>scope_not_granted</code>.
              </p>
            </div>
            <Switch checked={paymentScope} onCheckedChange={setPaymentScope} />
          </div>
          {identity ? (
            <p className="text-xs text-muted-foreground">
              Eligibility credential: {identity.credentialType}
              {identity.simulated ? " (demo-signed, not cryptographically verified)" : " (issued by your agent)"} — {identity.reason}
            </p>
          ) : null}
          {mandateJwt ? <TruncatedMono value={mandateJwt} label="Delegation credential JWT" /> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => run("no-credential")} disabled={busy || !wallet.address}>
              <ShieldAlert className="mr-2 h-4 w-4" /> Try without credential
            </Button>
            <Button variant="outline" onClick={() => run("low-cap")} disabled={busy || !wallet.address}>
              <ShieldAlert className="mr-2 h-4 w-4" /> Try with a cap below the price
            </Button>
            <Button
              variant="outline"
              onClick={() => run("wrong-principal")}
              disabled={busy || !wallet.address}
            >
              <ShieldAlert className="mr-2 h-4 w-4" /> Try a mandate for someone else
            </Button>
          </div>
          <StickyActionBar>
            <Button onClick={() => run("none")} disabled={busy || !wallet.address} className="w-full sm:w-auto">
              {busy ? "Paying…" : "Present, authorise, sign and settle"}
            </Button>
          </StickyActionBar>
        </CardContent>
      </Card>

      {steps.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment flow</CardTitle>
            <CardDescription>
              Credential, mandate, signature, settlement — every gate verdict and facilitator
              response is shown as it came back.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TranscriptView steps={steps} />
            {txHash ? (
              <a
                href={`${x402Cfg.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                View transaction on BaseScan <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {requirement ? (
              <p className="break-words text-xs text-muted-foreground">
                Asset {requirement.asset} · network {requirement.network} · scheme{" "}
                {requirement.scheme} · settled amount {formatUsdc(requirement.amount)} USDC
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
