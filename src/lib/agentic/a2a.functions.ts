import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server functions for the agentic demos. The buyer agent lives here: it talks
 * to the seller over real HTTP JSON-RPC, so the transcript the UI renders is a
 * recording of an actual A2A exchange rather than a client-side animation.
 */

const originSchema = z
  .string()
  .trim()
  .url()
  .refine((v) => v.startsWith("http://") || v.startsWith("https://"), "origin must be http(s)");

/** Identity context: real agent DIDs and credential when available. */
export const getAgenticIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveConnection } = await import("@/lib/identus/agent.server");
    const { demoCredentialJwt } = await import("@/lib/agentic/credentials.server");

    const fallbackIssuer = "did:prism:demo-issuer-acme-university-0000000000000000";
    const fallbackBuyer = "did:prism:demo-buyer-agent-0000000000000000000000000";
    const fallbackSeller = "did:prism:demo-seller-agent-000000000000000000000000";

    const conn = await getActiveConnection(context.supabase, context.userId);

    const [{ data: dids }, { data: creds }] = await Promise.all([
      context.supabase
        .from("saved_dids")
        .select("did, alias, role, status")
        .order("created_at", { ascending: true }),
      context.supabase
        .from("credential_records")
        .select("jwt, issuer_did, holder_did, schema_name, protocol_state, created_at")
        .not("jwt", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const list = dids ?? [];
    const holder = list.find((d: any) => d.role === "holder") ?? list[1] ?? null;
    const issuer =
      list.find((d: any) => d.role === "issuer" && d.status === "published") ??
      list.find((d: any) => d.role === "issuer") ??
      list[0] ??
      null;

    const realJwt = (creds ?? [])[0]?.jwt as string | undefined;
    const buyerDid = (holder?.did as string) ?? fallbackBuyer;
    const sellerDid = (issuer?.did as string) ?? fallbackSeller;
    const credentialType = "StudentIDCredential";

    const usingReal = Boolean(conn && conn.mode !== "simulated" && realJwt);
    const reason = !conn
      ? "No agent configured — running with demo DIDs and a demo credential."
      : conn.mode === "simulated"
        ? "Simulated agent mode — DIDs and credentials are local demo data."
        : realJwt
          ? `Using a credential issued by your ${conn.mode} agent.`
          : "Live agent configured, but no issued credential found yet — using a demo credential.";

    return {
      mode: (conn?.mode ?? null) as "simulated" | "docker" | "fly" | null,
      simulated: !usingReal,
      reason,
      buyerDid,
      sellerDid,
      buyerLabel: (holder?.alias as string) ?? "Buyer agent",
      sellerLabel: (issuer?.alias as string) ?? "Seller agent",
      credentialType,
      credentialJwt:
        realJwt ??
        demoCredentialJwt({
          issuerDid: (issuer?.did as string) ?? fallbackIssuer,
          subjectDid: buyerDid,
          type: credentialType,
          claims: { name: "Alice Holder", programme: "MSc Computer Science", enrolled: true },
        }),
    };
  });

/**
 * Full A2A negotiation: discover the seller card, send an IntentMandate,
 * answer the presentation request with a credential, accept the CartMandate,
 * submit a PaymentMandate. Every JSON-RPC envelope is captured for the UI.
 */
export const runA2ANegotiation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: originSchema,
        sku: z.string().trim().min(1),
        goal: z.string().trim().min(1).max(300),
        quantity: z.number().int().min(1).max(10).default(1),
        maxPrice: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "maxPrice must look like 9.99"),
        currency: z.string().trim().length(3).default("EUR"),
        buyerDid: z.string().trim().min(1),
        sellerDid: z.string().trim().min(1),
        credentialJwt: z.string().trim().optional(),
        withCredential: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { MIME } = await import("@/lib/agentic/types");
    const { buildIntent } = await import("@/lib/agentic/ap2");
    const { jsonHash } = await import("@/lib/agentic/hash");
    const { aisaChat } = await import("@/lib/agentic/aisa.server");
    const { dataPart, findDataPart, SETTLEMENT } = await import(
      "@/lib/agentic/negotiation.server"
    );

    type Entry = {
      step: number;
      label: string;
      actor: "buyer" | "seller" | "human" | "verifier";
      detail: string;
      envelope?: any;
      state?: string;
      simulated?: boolean;
    };
    const transcript: Entry[] = [];
    let step = 0;
    const push = (e: Omit<Entry, "step">) => transcript.push({ step: ++step, ...e });

    const sellerUrl = `${data.origin.replace(/\/$/, "")}/api/public/a2a-seller`;
    const aisaNotes: string[] = [];
    let aisaLive = false;

    const rpc = async (method: string, params: unknown) => {
      const body = { jsonrpc: "2.0", id: crypto.randomUUID(), method, params };
      const res = await fetch(sellerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => ({}));
      if (json?.error) {
        throw new Error(`Seller agent error [${json.error.code}]: ${json.error.message}`);
      }
      return { request: body, response: json, task: json?.result };
    };

    /* 1. Discovery */
    const cardRes = await fetch(`${sellerUrl}?did=${encodeURIComponent(data.sellerDid)}`);
    if (!cardRes.ok) throw new Error(`Seller agent card unavailable (${cardRes.status})`);
    const card = await cardRes.json();
    push({
      label: "Discover seller agent",
      actor: "buyer",
      detail: `Fetched the A2A agent card. Skills: ${(card.skills ?? []).map((s: any) => s.name).join(", ") || "none"}.`,
      envelope: card,
    });

    /* 2. Buyer plans with AIsa */
    const plan = await aisaChat(
      "You are a buying agent acting under a delegated mandate. You are concise and never exceed your spend limit.",
      `Your human asked: "${data.goal}". Your spend cap is ${data.maxPrice} ${data.currency} for SKU ${data.sku}. In at most two sentences, state your negotiation plan and the one credential you are willing to present as proof of eligibility.`,
    );
    if (plan.error) aisaNotes.push(plan.error);
    if (!plan.simulated) aisaLive = true;
    const intent = buildIntent({
      buyerDid: data.buyerDid,
      goal: data.goal,
      sku: data.sku,
      quantity: data.quantity,
      maxPrice: data.maxPrice,
      currency: data.currency,
      sellerDid: data.sellerDid,
    });
    push({
      label: "Build IntentMandate",
      actor: "buyer",
      detail:
        plan.text ??
        `Cap set at ${data.maxPrice} ${data.currency}; will present an eligibility credential if the seller asks.`,
      envelope: intent,
      simulated: plan.simulated,
    });

    /* 3. Send the intent */
    let sent = await rpc("message/send", {
      sellerDid: data.sellerDid,
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [dataPart(MIME.intent, intent)],
      },
    });
    let task = sent.task;
    push({
      label: "message/send · IntentMandate",
      actor: "seller",
      detail: `Task ${String(task?.id ?? "").slice(0, 8)} → ${task?.status?.state}. ${task?.status?.reason ?? ""}`.trim(),
      envelope: sent.response,
      state: task?.status?.state,
    });

    if (task?.status?.state === "rejected") {
      return finish("rejected", null, null);
    }

    /* 4. Answer a presentation request */
    const askPart = findDataPart(task?.status?.message?.parts, MIME.presentationRequest);
    if (askPart) {
      if (!data.withCredential || !data.credentialJwt) {
        push({
          label: "Presentation withheld",
          actor: "human",
          detail:
            "The seller asked for an eligibility credential and the buyer agent has none to present, so the discount path stops here.",
          envelope: askPart.data,
        });
        return finish("input-required", null, null);
      }
      const ask = askPart.data as any;
      push({
        label: "Presentation requested",
        actor: "seller",
        detail: `Seller wants a ${ask.credentialType} (challenge ${String(ask.challenge).slice(0, 12)}…) before pricing below list.`,
        envelope: ask,
      });
      sent = await rpc("message/send", {
        sellerDid: data.sellerDid,
        taskId: task.id,
        message: {
          role: "user",
          messageId: crypto.randomUUID(),
          parts: [
            dataPart(MIME.presentation, {
              requestId: ask.requestId,
              challenge: ask.challenge,
              credentialJwt: data.credentialJwt,
              holder: data.buyerDid,
            }),
          ],
        },
      });
      task = sent.task;
      push({
        label: "Credential presented and checked",
        actor: "verifier",
        detail:
          task?.status?.state === "rejected"
            ? `Seller rejected the presentation: ${task?.status?.reason}`
            : "Seller verified issuer, type and expiry, then repriced the cart.",
        envelope: sent.response,
        state: task?.status?.state,
      });
      if (task?.status?.state === "rejected") return finish("rejected", null, null);
    }

    /* 5. Evaluate the cart */
    const cartPart = findDataPart(task?.status?.message?.parts, MIME.cart);
    const prPart = findDataPart(task?.status?.message?.parts, MIME.paymentRequired);
    if (!cartPart) {
      push({
        label: "No cart offered",
        actor: "seller",
        detail: "The seller ended the exchange without a CartMandate.",
        envelope: task,
      });
      return finish(task?.status?.state ?? "failed", null, null);
    }
    const cart = cartPart.data as any;
    const withinCap =
      Number.parseFloat(cart.total.amount) <=
      Number.parseFloat(data.maxPrice) * data.quantity + 1e-9;
    const review = await aisaChat(
      "You are a buying agent reviewing a quote against your mandate. Answer in one sentence.",
      `Quote: ${cart.total.amount} ${cart.total.currency} for ${cart.items?.[0]?.name}. Your cap: ${data.maxPrice} ${data.currency} per unit, quantity ${data.quantity}. Seller rationale: "${cart.rationale}". Do you accept? Say why in one sentence.`,
    );
    if (review.error) aisaNotes.push(review.error);
    if (!review.simulated) aisaLive = true;
    push({
      label: withinCap ? "Cart accepted" : "Cart over mandate",
      actor: "buyer",
      detail:
        review.text ??
        (withinCap
          ? `${cart.total.amount} ${cart.total.currency} is within the mandate — accepting.`
          : `${cart.total.amount} ${cart.total.currency} exceeds the mandate cap — refusing.`),
      envelope: cart,
      simulated: review.simulated,
    });
    if (!withinCap) return finish("rejected", cart, null);

    /* 6. Submit the payment mandate */
    const cartHash = await jsonHash(cart);
    const paymentMandate = {
      ap2Version: "0.1" as const,
      paymentId: crypto.randomUUID(),
      cartHash,
      buyerDid: data.buyerDid,
      amount: cart.total,
      settlement: {
        scheme: "x402-exact",
        network: (prPart?.data as any)?.network ?? SETTLEMENT.network,
      },
    };
    sent = await rpc("message/send", {
      sellerDid: data.sellerDid,
      taskId: task.id,
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [dataPart(MIME.payment, paymentMandate)],
      },
    });
    task = sent.task;
    const grant = findDataPart(task?.artifacts?.[0]?.parts, MIME.fulfilment);
    push({
      label: task?.status?.state === "completed" ? "Settled and granted" : "Payment rejected",
      actor: "seller",
      detail:
        task?.status?.state === "completed"
          ? `Seller matched the cart hash and issued an access grant with scope ${((grant?.data as any)?.scope ?? []).join(", ")}.`
          : (task?.status?.reason ?? "Seller did not accept the PaymentMandate."),
      envelope: sent.response,
      state: task?.status?.state,
    });

    return finish(task?.status?.state ?? "failed", cart, paymentMandate);

    async function finish(status: string, cart: any, payment: any) {
      const simulated = !aisaLive;
      await context.supabase.from("agentic_sessions").insert({
        user_id: context.userId,
        kind: "a2a",
        status,
        simulated,
        buyer_did: data.buyerDid,
        seller_did: data.sellerDid,
        transcript: transcript as any,
        payload: { cart, payment, sku: data.sku, goal: data.goal, aisaNotes } as any,
      });
      return {
        status,
        simulated,
        aisaLive,
        aisaNotes,
        transcript,
        cart,
        payment,
        card,
      };
    }
  });

/** Recent demo runs, newest first — used by the demo pages' history strip. */
export const listAgenticSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: z.enum(["a2a", "ap2", "ucp", "x402"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("agentic_sessions")
      .select("id, kind, status, simulated, tx_hash, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data.kind) query = query.eq("kind", data.kind);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Persist a client-driven demo run (AP2 signing, UCP conformance, x402). */
export const recordAgenticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["ap2", "ucp", "x402"]),
        status: z.string().trim().min(1).max(40),
        simulated: z.boolean().default(true),
        buyerDid: z.string().trim().optional(),
        sellerDid: z.string().trim().optional(),
        txHash: z.string().trim().optional(),
        transcript: z.array(z.any()).max(60).default([]),
        payload: z.record(z.string(), z.any()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agentic_sessions").insert({
      user_id: context.userId,
      kind: data.kind,
      status: data.status,
      simulated: data.simulated,
      buyer_did: data.buyerDid ?? null,
      seller_did: data.sellerDid ?? null,
      tx_hash: data.txHash ?? null,
      transcript: data.transcript,
      payload: data.payload,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Recover the signer of an AP2 mandate signature. The demo shows that a
 * mandate is verifiable by anyone — not just the merchant that received it.
 */
export const verifyMandateSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        typedData: z.object({
          domain: z.record(z.string(), z.any()),
          types: z.record(z.string(), z.any()),
          primaryType: z.string(),
          message: z.record(z.string(), z.any()),
        }),
        signature: z.string().trim().regex(/^0x[0-9a-fA-F]+$/, "signature must be 0x-hex"),
        expectedSigner: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { recoverTypedDataAddress } = await import("viem");
    try {
      const address = await recoverTypedDataAddress({
        domain: data.typedData.domain as any,
        types: data.typedData.types as any,
        primaryType: data.typedData.primaryType as any,
        message: data.typedData.message as any,
        signature: data.signature as `0x${string}`,
      });
      const matches = data.expectedSigner
        ? address.toLowerCase() === data.expectedSigner.toLowerCase()
        : null;
      return { ok: true as const, signer: address, matches, error: null as string | null };
    } catch (err) {
      return {
        ok: false as const,
        signer: null,
        matches: false,
        error: err instanceof Error ? err.message : "recovery failed",
      };
    }
  });
