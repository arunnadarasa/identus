import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  Plane,
  ShoppingCart,
  Store,
  Coins,
  KeyRound,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UseCase = {
  id: string;
  protocol: string;
  title: string;
  summary: string;
  icon: typeof Plane;
  actors: string[];
  flow: string[];
  delegation: string;
  without: string;
  demo: string;
};

const useCases: UseCase[] = [
  {
    id: "a2a",
    protocol: "A2A",
    title: "Travel booking negotiation",
    summary:
      "Your agent negotiates a fare with an airline's agent — and each side proves who it works for.",
    icon: Plane,
    actors: ["Alice's agent (buyer)", "Airline agent (seller)"],
    flow: [
      "Buyer agent discovers the seller's agent card and its declared skills.",
      "Both agents exchange DIDs in the opening A2A message.",
      "Each verifies the other's credential issuer, expiry and revocation status.",
      "They negotiate fare, cabin and change rules over A2A tasks.",
      "On agreement, the task hands off to a payment protocol (AP2 or x402).",
    ],
    delegation:
      "Before any offer is accepted, the buyer agent presents a delegation credential naming its principal (Alice) and its scope — book travel, EUR 500 cap, 30 days.",
    without:
      "An API key proves only that some caller has a secret — not who it acts for, nor whether the mandate still stands.",
    demo: "/app/demos",
  },
  {
    id: "ap2",
    protocol: "AP2",
    title: "Mandated purchase within a budget",
    summary:
      "Alice signs a mandate once; the agent shops and the merchant verifies the mandate offline.",
    icon: ShoppingCart,
    actors: ["Alice (principal)", "Alice's agent", "Merchant"],
    flow: [
      "Alice signs an intent mandate: cap, merchant class, expiry.",
      "The agent shops and assembles a cart mandate for a concrete order.",
      "Merchant verifies both signatures, freshness and that the cart sits under the cap.",
      "Merchant charges within the cap and keeps the mandate as its audit record.",
    ],
    delegation:
      "The signed mandate is the delegation. It is verifiable without calling Alice back, and revoking the credential stops every future charge.",
    without:
      "The merchant has to trust the agent's claim about its spending limit, or Alice must approve every single step.",
    demo: "/app/demos",
  },
  {
    id: "ucp",
    protocol: "UCP",
    title: "Commerce capability discovery",
    summary:
      "The agent reads what a merchant can do, then calls only the actions it is actually allowed to call.",
    icon: Store,
    actors: ["Alice's agent", "Merchant capability endpoint"],
    flow: [
      "Agent fetches the merchant's capability manifest (search, quote, checkout).",
      "Agent compares each capability's required scope with its own delegated scope.",
      "Agent invokes a permitted capability — quote, then checkout.",
      "Merchant re-checks the presented delegation for that specific capability.",
    ],
    delegation:
      "The intersection of the capability's declared scope and the agent's delegated scope decides what may be invoked — refunds or subscriptions stay out of reach unless delegated.",
    without:
      "Capability discovery becomes an all-or-nothing token: any agent with the key can invoke every action the merchant exposes.",
    demo: "/app/demos",
  },
  {
    id: "x402",
    protocol: "x402",
    title: "Pay-per-call resource access",
    summary:
      "The agent pays a machine-priced endpoint on Base Sepolia and retries with proof of payment.",
    icon: Coins,
    actors: ["Alice's agent", "Paid API resource", "Base Sepolia"],
    flow: [
      "Agent calls the resource and receives HTTP 402 with price, asset and payee address.",
      "Agent checks the price against its delegated spend budget.",
      "Agent pays on Base Sepolia and captures the transaction hash.",
      "Agent retries with the X-PAYMENT header; the resource settles and returns the data.",
    ],
    delegation:
      "Spend is bounded by the AP2 mandate the agent holds, and the resource can additionally require a credential presentation before it serves anything.",
    without:
      "Either a human approves each micro-payment, or the agent holds an unbounded wallet with no verifiable ceiling.",
    demo: "/app/demos",
  },
];

function UseCaseCard({ uc }: { uc: UseCase }) {
  const [open, setOpen] = useState(false);
  const Icon = uc.icon;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-card/70 sm:p-5 md:cursor-default md:hover:bg-transparent"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/40 font-mono text-[10px] text-primary"
            >
              {uc.protocol}
            </Badge>
            <span className="font-display text-sm font-semibold">
              {uc.title}
            </span>
          </span>
          <span className="mt-1.5 block text-sm text-muted-foreground">
            {uc.summary}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform md:hidden",
            open && "rotate-180",
          )}
        />
      </button>

      <div className={cn("md:block", open ? "block" : "hidden")}>
        <div className="border-t border-border/60 px-4 pb-5 pt-4 sm:px-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Actors
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {uc.actors.join(" · ")}
          </p>

          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Sample flow
          </p>
          <ol className="mt-2 space-y-2">
            {uc.flow.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-md border-l-2 border-primary/60 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary">
              <KeyRound className="h-3.5 w-3.5" />
              Where delegation fits
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {uc.delegation}
            </p>
          </div>

          <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              <span className="font-medium text-foreground">Without SSI:</span>{" "}
              {uc.without}
            </span>
          </p>

          <Link
            to={uc.demo}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Run the {uc.protocol} demo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AgenticUseCases() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {useCases.map((uc) => (
        <UseCaseCard key={uc.id} uc={uc} />
      ))}
    </div>
  );
}
