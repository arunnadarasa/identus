import { Bot, CreditCard, ShoppingBag, Coins } from "lucide-react";

const protocols = [
  {
    name: "A2A",
    subtitle: "Agent-to-Agent",
    icon: Bot,
    what: "How agents discover each other and collaborate on a task.",
    fit: "Each agent gets its own DID, so identity and capability claims are portable and checkable — not trusted just because of a hostname.",
  },
  {
    name: "AP2",
    subtitle: "Agent Payments Protocol",
    icon: CreditCard,
    what: "Lets an agent pay on your behalf using a signed mandate.",
    fit: "That mandate is a verifiable credential: a scoped, expiring, revocable delegation instead of a stored card number.",
  },
  {
    name: "UCP",
    subtitle: "Universal Commerce Protocol",
    icon: ShoppingBag,
    what: "Machine-readable commerce so agents can transact with merchants.",
    fit: "Merchant and buyer-agent credentials (KYB, age, entitlement) get verified in-line — no account signup step.",
  },
  {
    name: "x402",
    subtitle: "HTTP 402 pay-per-call",
    icon: Coins,
    what: "Machine clients pay per request instead of holding an API key.",
    fit: "Pair the payment proof with a credential proof so a service can price and authorise a caller in one round trip.",
  },
];

const claims = [
  ["actsFor", "who the agent represents"],
  ["scope", "what it may do"],
  ["spendLimit", "how much it may spend"],
  ["expiry", "when it stops working"],
  ["revocable", "switch it off instantly"],
];

export function AgenticStack() {
  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-2">
        {protocols.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.name}
              className="rounded-lg border border-border/60 bg-card/60 p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-mono text-sm font-medium text-primary">
                    {p.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{p.subtitle}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-foreground">{p.what}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  Where SSI fits:{" "}
                </span>
                {p.fit}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border/60 bg-card/30 p-5">
        <h3 className="font-display text-base font-semibold">
          What an agent credential carries
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {claims.map(([key, gloss]) => (
            <span
              key={key}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs"
            >
              <span className="font-mono text-primary">{key}</span>
              <span className="text-muted-foreground"> · {gloss}</span>
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Revoking one agent's credential doesn't touch any of your other
          credentials — you retire the delegation, not your identity.
        </p>
      </div>
    </div>
  );
}
