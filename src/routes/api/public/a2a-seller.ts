/**
 * A2A 0.3 seller agent. GET returns the agent card, POST speaks JSON-RPC
 * (`message/send`, `tasks/get`). Public by design — A2A peers are external
 * callers — so it never touches user data and only serves demo inventory.
 */
import { createFileRoute } from "@tanstack/react-router";

import type {
  A2AMessage,
  A2ATask,
  CartMandate,
  IntentMandate,
  JsonRpcRequest,
  JsonRpcResponse,
  PaymentMandate,
  PaymentRequired,
} from "@/lib/agentic/types";
import { MIME } from "@/lib/agentic/types";

type TaskContext = {
  intent: IntentMandate;
  sku: string;
  cart?: CartMandate;
  payment?: PaymentRequired;
};

const contexts = new Map<string, TaskContext>();

function rpcOk(id: string, result: unknown): Response {
  const body: JsonRpcResponse = { jsonrpc: "2.0", id, result };
  return Response.json(body);
}

function rpcErr(id: string, code: number, message: string): Response {
  const body: JsonRpcResponse = { jsonrpc: "2.0", id, error: { code, message } };
  return Response.json(body, { status: 200 });
}

function agentCard(origin: string, sellerDid: string) {
  return {
    name: "Identus Seller Agent",
    description:
      "Sells verified transcript and verification-API access. Prices below list require a verifiable credential proof.",
    url: `${origin}/api/public/a2a-seller`,
    version: "0.3",
    provider: { organization: "Identus Companion" },
    did: sellerDid,
    capabilities: { streaming: false, pushNotifications: false },
    skills: [
      {
        id: "negotiate-access",
        name: "Negotiate access",
        description:
          "Accepts an AP2 IntentMandate, returns a signed CartMandate plus an x402 payment-required challenge.",
        inputModes: [MIME.intent, MIME.presentation],
        outputModes: [MIME.cart, MIME.paymentRequired, MIME.presentationRequest],
      },
    ],
    extensions: [
      { uri: "https://a2a.dev/extensions/x402", params: { networks: ["eip155:84532"] } },
      { uri: "https://a2a.dev/extensions/ap2", params: { mandates: ["intent", "cart", "payment"] } },
    ],
  };
}

export const Route = createFileRoute("/api/public/a2a-seller")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const did =
          new URL(request.url).searchParams.get("did") ??
          "did:prism:seller-demo-0000000000000000000000000000000000000000";
        return Response.json(agentCard(origin, did));
      },

      POST: async ({ request }) => {
        const {
          buildCart,
          findDataPart,
          findItem,
          inspectCredential,
          jsonHash,
          newTask,
          getTask,
          putTask,
          paymentRequired,
          priceDecision,
          dataPart,
          uuid,
          money,
        } = await import("@/lib/agentic/negotiation.server");
        const { aisaChat } = await import("@/lib/agentic/aisa.server");

        let body: JsonRpcRequest;
        try {
          body = (await request.json()) as JsonRpcRequest;
        } catch {
          return rpcErr("0", -32700, "Parse error");
        }
        const id = String(body?.id ?? uuid());

        if (body?.method === "tasks/get") {
          const taskId = String((body.params as any)?.id ?? "");
          const task = getTask(taskId);
          if (!task) return rpcErr(id, -32001, "Task not found");
          return rpcOk(id, task);
        }

        if (body?.method !== "message/send") {
          return rpcErr(id, -32601, `Method not found: ${String(body?.method)}`);
        }

        const params = (body.params ?? {}) as {
          message?: A2AMessage;
          taskId?: string;
          contextId?: string;
        };
        const parts = params.message?.parts ?? [];
        const sellerDid =
          String((params as any).sellerDid ?? "") ||
          "did:prism:seller-demo-0000000000000000000000000000000000000000";

        /* ---------- Follow-up: buyer submits a PaymentMandate ---------- */
        const paymentPart = findDataPart(parts, MIME.payment);
        if (paymentPart && params.taskId) {
          const task = getTask(params.taskId);
          const ctx = contexts.get(params.taskId);
          if (!task || !ctx?.cart) return rpcErr(id, -32001, "Unknown task");
          const mandate = paymentPart.data as PaymentMandate;
          const expectedHash = await jsonHash(ctx.cart);
          if (mandate.cartHash !== expectedHash) {
            const failed: A2ATask = {
              ...task,
              status: {
                state: "failed",
                timestamp: new Date().toISOString(),
                reason: "PaymentMandate cartHash does not match the issued CartMandate.",
              },
            };
            return rpcOk(id, putTask(failed));
          }
          const completed: A2ATask = {
            ...task,
            status: {
              state: "completed",
              timestamp: new Date().toISOString(),
              message: {
                role: "agent",
                messageId: uuid(),
                parts: [
                  dataPart(MIME.payment, { ...mandate, accepted: true }, { verified: true }),
                ],
              },
            },
            artifacts: [
              {
                name: "access-grant",
                parts: [
                  dataPart(MIME.fulfilment, {
                    grantId: uuid(),
                    sku: ctx.sku,
                    holder: mandate.buyerDid,
                    issuedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 365 * 86400_000).toISOString(),
                    scope: ["read:transcript", "verify:credential"],
                  }),
                ],
              },
            ],
          };
          return rpcOk(id, putTask(completed));
        }

        /* ---------- Follow-up: buyer presents a credential ---------- */
        const presentationPart = findDataPart(parts, MIME.presentation);
        if (presentationPart && params.taskId) {
          const task = getTask(params.taskId);
          const ctx = contexts.get(params.taskId);
          if (!task || !ctx) return rpcErr(id, -32001, "Unknown task");
          const item = findItem(ctx.sku);
          if (!item) return rpcErr(id, -32602, "Unknown sku");

          const jwt = String((presentationPart.data as any)?.credentialJwt ?? "");
          const check = inspectCredential(jwt, item.discountCredential);
          const decision = priceDecision(item, ctx.intent, check);

          if (decision.kind !== "quote") {
            const rejected: A2ATask = {
              ...task,
              status: {
                state: "rejected",
                timestamp: new Date().toISOString(),
                reason: decision.rationale,
              },
            };
            return rpcOk(id, putTask(rejected));
          }

          const aisa = await aisaChat(
            "You are a seller agent in an agent-to-agent commerce negotiation. Be brief and commercial.",
            `Explain in at most two sentences why you are granting a discounted price of ${decision.price} ${item.currency} for "${item.name}" after verifying a ${check.type ?? item.discountCredential} issued by ${check.issuer}. The buyer's cap was ${ctx.intent.maxPrice.amount} ${ctx.intent.maxPrice.currency}.`,
          );
          const cart = await buildCart(
            item,
            ctx.intent,
            sellerDid,
            decision.price,
            aisa.text ?? decision.rationale,
          );
          const pr = paymentRequired(cart.total.amount);
          contexts.set(task.id, { ...ctx, cart, payment: pr });

          const quoted: A2ATask = {
            ...task,
            status: {
              state: "input-required",
              timestamp: new Date().toISOString(),
              message: {
                role: "agent",
                messageId: uuid(),
                parts: [
                  dataPart(MIME.cart, cart, {
                    verification: check,
                    aisa: aisa.simulated ? "scripted" : "live",
                  }),
                  dataPart(MIME.paymentRequired, pr),
                ],
              },
            },
          };
          return rpcOk(id, putTask(quoted));
        }

        /* ---------- Opening move: IntentMandate ---------- */
        const intentPart = findDataPart(parts, MIME.intent);
        if (!intentPart) {
          return rpcErr(id, -32602, `Expected a DataPart with mimeType ${MIME.intent}`);
        }
        const intent = intentPart.data as IntentMandate;
        const item = findItem(intent.sku);
        if (!item) return rpcErr(id, -32602, `Unknown sku: ${String(intent.sku)}`);
        if (!Number.isFinite(money(intent.maxPrice?.amount ?? ""))) {
          return rpcErr(id, -32602, "IntentMandate maxPrice.amount must be numeric");
        }

        const task = newTask(params.contextId ?? uuid(), "working");
        contexts.set(task.id, { intent, sku: intent.sku });
        const decision = priceDecision(item, intent, null);

        if (decision.kind === "reject") {
          const rejected: A2ATask = {
            ...task,
            status: {
              state: "rejected",
              timestamp: new Date().toISOString(),
              reason: decision.rationale,
            },
          };
          return rpcOk(id, putTask(rejected));
        }

        if (decision.kind === "needs-proof") {
          const asking: A2ATask = {
            ...task,
            status: {
              state: "input-required",
              timestamp: new Date().toISOString(),
              message: {
                role: "agent",
                messageId: uuid(),
                parts: [dataPart(MIME.presentationRequest, decision.request)],
              },
              reason: decision.rationale,
            },
          };
          return rpcOk(id, putTask(asking));
        }

        const cart = await buildCart(item, intent, sellerDid, decision.price, decision.rationale);
        const pr = paymentRequired(cart.total.amount);
        contexts.set(task.id, { intent, sku: intent.sku, cart, payment: pr });
        const quoted: A2ATask = {
          ...task,
          status: {
            state: "input-required",
            timestamp: new Date().toISOString(),
            message: {
              role: "agent",
              messageId: uuid(),
              parts: [dataPart(MIME.cart, cart), dataPart(MIME.paymentRequired, pr)],
            },
          },
        };
        return rpcOk(id, putTask(quoted));
      },
    },
  },
});
