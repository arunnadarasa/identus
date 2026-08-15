import { User, Bot, Building2, ArrowDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

export const delegationHopCount = steps.length;

type DelegationChainProps = {
  /** Index of the hop currently being explained. Omit for the plain static view. */
  activeIndex?: number;
  /** Hops up to and including this index render as completed. */
  completedThrough?: number;
  /** Hide the closing caption when the surrounding panel already says it. */
  hideCaption?: boolean;
};

export function DelegationChain({
  activeIndex,
  completedThrough,
  hideCaption,
}: DelegationChainProps = {}) {
  const guided = typeof activeIndex === "number";

  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6">
      <div className="flex flex-col items-stretch gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = guided && activeIndex === i;
          const isDone =
            guided &&
            typeof completedThrough === "number" &&
            i <= completedThrough &&
            !isActive;
          const isDim = guided && !isActive && !isDone;
          return (
            <div key={s.title}>
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border bg-card/60 p-4 transition-all sm:gap-4",
                  isActive
                    ? "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                    : "border-border/60",
                  isDim && "opacity-45",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {isDone ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="font-display text-sm font-semibold">
                      {s.title}
                    </h4>
                    <span className="max-w-full truncate font-mono text-xs text-muted-foreground">
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
      {!hideCaption && (
        <p className="mt-4 text-xs text-muted-foreground">
          Every hop is cryptographically checkable, so nobody has to store your
          card, your password, or a copy of your identity.
        </p>
      )}
    </div>
  );
}
