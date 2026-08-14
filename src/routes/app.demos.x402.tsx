import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Coins, ExternalLink, RefreshCw, Wallet } from "lucide-react";

import { recordAgenticSession } from "@/lib/agentic/a2a.functions";
import { getAgenticConfig } from "@/lib/agentic/config.functions";
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
import { PrivyRoot } from "@/components/PrivyRoot";
import { useWalletSigner } from "@/lib/use-wallet-signer";
import { TranscriptView, type TranscriptStep } from "@/components/agentic/TranscriptView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StickyActionBar } from "@/components/StickyActionBar";

export const Route = createFileRoute("/app/demos/x402")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "x402 USDC settlement demo — Identus Companion" },
      {
        name: "description",
        content:
          "Take a real HTTP 402 challenge, sign an EIP-3009 USDC authorization in an embedded wallet, and settle it on Base Sepolia through an x402 facilitator.",
      },
      { property: "og:title", content: "x402 USDC settlement demo" },
      {
        property: "og:description",
        content: "Pay-per-call agent payments settled in testnet USDC on Base Sepolia.",
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

function X402Demo({ hasPrivy }: { hasPrivy: boolean }) {
  const wallet = useWalletSigner();
  const recordFn = useServerFn(recordAgenticSession);

  const [steps, setSteps] = useState<TranscriptStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<PaymentRequirement | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

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

  const run = async () => {
    if (!wallet.signTypedData || !wallet.address) {
      toast.error("Connect a wallet first");
      return;
    }
    setBusy(true);
    setSteps([]);
    setTxHash(null);
    try {
      /* 1. Challenge */
      const { status, challenge, raw } = await fetchChallenge();
      if (status !== 402 || !challenge) {
        push({
          label: "Unexpected challenge response",
          actor: "seller",
          detail: `Expected HTTP 402 from the facilitator, got ${status}.`,
          envelope: raw.slice(0, 800),
        });
        return;
      }
      const req = pickRequirement(challenge);
      setRequirement(req);
      if (!req) {
        push({
          label: "No usable payment requirement",
          actor: "seller",
          detail: `The 402 listed no "exact" requirement on ${x402Cfg.network}.`,
          envelope: challenge,
        });
        return;
      }
      push({
        label: "HTTP 402 payment required",
        actor: "seller",
        detail: `Resource costs ${formatUsdc(req.amount)} USDC on ${x402Cfg.chainName}, payable to ${req.payTo.slice(0, 10)}….`,
        envelope: challenge,
      });

      /* 2. Sign the EIP-3009 authorization */
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
          "The wallet signed a transfer authorization — no gas, no on-chain transaction yet. The facilitator will submit it.",
        envelope,
      });

      /* 3. Retry with payment */
      const paid = await fetchPaid(header);
      if (paid.status !== 200) {
        push({
          label: "Facilitator rejected the payment",
          actor: "verifier",
          detail: `HTTP ${paid.status}. Facilitator errors are the only signal here, so the body is shown verbatim.`,
          envelope: paid.body.slice(0, 1200),
        });
        await recordFn({
          data: {
            kind: "x402",
            status: `rejected-${paid.status}`,
            simulated: false,
            payload: { body: paid.body.slice(0, 1000), requirement: req },
          },
        });
        toast.error("Payment was not accepted");
        return;
      }

      const hash = paid.receipt?.transaction ?? null;
      setTxHash(hash);
      push({
        label: "Settled on-chain",
        actor: "verifier",
        detail: hash
          ? `Facilitator settled the transfer in transaction ${hash.slice(0, 12)}… on ${paid.receipt?.network ?? x402Cfg.chainName}.`
          : "Resource unlocked, but the facilitator returned no transaction hash.",
        envelope: { receipt: paid.receipt, body: paid.body.slice(0, 600) },
      });

      await recordFn({
        data: {
          kind: "x402",
          status: "settled",
          simulated: false,
          txHash: hash ?? undefined,
          payload: { receipt: paid.receipt ?? null, requirement: req, payer: wallet.address },
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
          Credentials prove who an agent is; x402 lets it pay. The endpoint answers HTTP 402 with its
          price, your wallet signs a gasless USDC transfer authorization, and the facilitator settles
          it on Base Sepolia. This is a real testnet transaction — fund the wallet first.
        </p>
      </div>

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
          <StickyActionBar>
            <Button onClick={run} disabled={busy || !wallet.address} className="w-full sm:w-auto">
              {busy ? "Paying…" : "Fetch, sign and settle"}
            </Button>
          </StickyActionBar>
        </CardContent>
      </Card>

      {steps.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment flow</CardTitle>
            <CardDescription>
              Challenge, signature, settlement — every response from the facilitator is shown as it
              came back.
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
              <p className="text-xs text-muted-foreground">
                Asset {requirement.asset} · network {requirement.network} · scheme{" "}
                {requirement.scheme}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
