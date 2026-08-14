import { User, Bot, Building2, ArrowDown } from "lucide-react";

const steps = [
  {
    icon: User,
    title: "Alice",
    meta: "did:prism:alice…",
    note: "Issues a delegation credential — scope: book travel · limit EUR 500 · expires in 30 days.",
  },
  {
    icon: Bot,
    title: "Alice's agent",
    meta: "did:prism:agent…",
    note: "Holds the credential and presents proof (plus payment) when it acts.",
  },
  {
    icon: Building2,
    title: "Airline / service",
    meta: "verifier",
    note: "Checks the issuer, the scope, the expiry, and revocation status before accepting.",
  },
];

export function DelegationChain() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-5 sm:p-6">
      <div className="flex flex-col items-stretch gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title}>
              <div className="flex items-start gap-4 rounded-lg border border-border/60 bg-card/60 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="font-display text-sm font-semibold">
                      {s.title}
                    </h4>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {s.meta}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-1 text-primary/60">
                  <ArrowDown className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Every hop is cryptographically checkable, so nobody has to store your
        card, your password, or a copy of your identity.
      </p>
    </div>
  );
}
