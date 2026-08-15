import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Mints the delegation credential the x402 gate checks before it forwards a
 * payment. Real agent → the human/agent DIDs come from the console's saved DIDs;
 * simulated agent → structurally identical demo JWT, badged as such.
 */
export const issueX402Mandate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentName: z.string().trim().min(1).max(80).default("Shopping agent"),
        spendLimit: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,6})?$/, "spend limit must be a decimal amount"),
        validMinutes: z.number().int().min(1).max(60 * 24 * 30).default(60),
        payerWallet: z.string().trim().max(80).optional(),
        allowedMerchants: z.array(z.string().trim().max(80)).max(5).default([]),
        includePaymentScope: z.boolean().default(true),
        /**
         * The human the mandate acts for. The demo passes the subject of the
         * eligibility credential so `actsFor` matches whoever presented it.
         */
        principalDid: z.string().trim().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActiveConnection } = await import("@/lib/identus/agent.server");
    const { demoCredentialJwt } = await import("@/lib/agentic/credentials.server");
    const { DELEGATION_CREDENTIAL_TYPE, PAYMENT_SCOPE, PRICE_TIERS } = await import(
      "@/lib/agentic/x402-mandate"
    );

    const conn = await getActiveConnection(context.supabase, context.userId);
    const { data: dids } = await context.supabase
      .from("saved_dids")
      .select("did, alias, role, status")
      .order("created_at", { ascending: true });

    const list = dids ?? [];
    const humanDid =
      data.principalDid ??
      (list.find((d: any) => d.role === "holder")?.did as string) ??
      "did:prism:demo-human-alice-00000000000000000000000000";
    // The agent is its own identity, not "the other holder". Prefer a DID the
    // user explicitly named for an agent, then any second holder DID, and only
    // then fall back to the demo placeholder.
    const DEMO_AGENT_DID = "did:prism:demo-shopping-agent-0000000000000000000000";
    const agentDid =
      (list.find(
        (d: any) => /agent|bot/i.test(String(d.alias ?? "")) && d.did !== humanDid,
      )?.did as string) ??
      (list.find((d: any) => d.role === "holder" && d.did !== humanDid)?.did as string) ??
      DEMO_AGENT_DID;
    const agentDidIsPlaceholder = agentDid === DEMO_AGENT_DID;
    const issuerDid =
      (list.find((d: any) => d.role === "issuer" && d.status === "published")?.did as string) ??
      (list.find((d: any) => d.role === "issuer")?.did as string) ??
      humanDid;

    const validUntil = new Date(Date.now() + data.validMinutes * 60_000).toISOString();
    const claims = {
      actsFor: humanDid,
      agentName: data.agentName,
      scope: data.includePaymentScope ? [PAYMENT_SCOPE, "cart:negotiate"] : ["cart:negotiate"],
      spendLimit: { amount: data.spendLimit, currency: PRICE_TIERS.currency },
      ...(data.payerWallet ? { payerWallet: data.payerWallet } : {}),
      ...(data.allowedMerchants.length ? { allowedMerchants: data.allowedMerchants } : {}),
      validUntil,
    };

    const jwt = demoCredentialJwt({
      issuerDid,
      subjectDid: agentDid,
      type: DELEGATION_CREDENTIAL_TYPE,
      claims,
    });

    return {
      jwt,
      claims,
      humanDid,
      agentDid,
      agentDidIsPlaceholder,
      issuerDid,
      validUntil,
      mode: (conn?.mode ?? null) as "simulated" | "docker" | "fly" | null,
      simulated: true,
      reason:
        conn && conn.mode !== "simulated"
          ? "Delegation credentials are minted locally for this demo; issue one from the Credentials page for a fully agent-signed mandate."
          : "Simulated agent mode — the mandate is demo-signed, not cryptographically verified.",
    };
  });
