import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DelegationChain } from "@/components/learn/DelegationChain";

type Step = {
  title: string;
  hop: number;
  what: string;
  why: string;
  checks: string[];
  web2: string;
};

const STEPS: Step[] = [
  {
    title: "Alice has an identity she owns",
    hop: 0,
    what: "Alice's wallet creates a DID — a public identifier with a private key only she holds. No sign-up form, no company account.",
    why: "Everything later is signed with that key, so a permission can be traced back to Alice without anyone storing her personal details.",
    checks: ["DID document", "Key she controls"],
    web2: "You'd create yet another account, and the company would own it.",
  },
  {
    title: "Alice writes the permission down",
    hop: 0,
    what: "She issues her agent a delegation credential that says exactly what it may do: book travel, spend up to EUR 500, valid for 30 days.",
    why: "The permission is narrow by construction. Even if the agent misbehaves or is compromised, that's the worst it can do.",
    checks: ["Scope: book travel", "Limit: EUR 500", "Expires: 30 days"],
    web2: "You'd paste in a card number or an API key with no limits at all.",
  },
  {
    title: "The agent holds a badge, not your keys",
    hop: 1,
    what: "The agent stores the signed credential in its own wallet, under its own DID. It never receives Alice's password, card, or private key.",
    why: "There is nothing worth stealing from the agent beyond a badge that expires and can be revoked at any moment.",
    checks: ["Agent DID", "Signed by Alice", "Revocable"],
    web2: "The agent would hold a long-lived secret that unlocks your whole account.",
  },
  {
    title: "The agent acts and shows its proof",
    hop: 1,
    what: "When it books a flight, the agent presents the delegation plus proof it controls its own DID — revealing only the fields the airline needs.",
    why: "The airline learns 'this agent is authorised by a real person, within these limits' without learning who Alice is or seeing her card.",
    checks: ["Proof of possession", "Selective disclosure"],
    web2: "You'd hand over full identity and payment details on every booking.",
  },
  {
    title: "The airline verifies before it accepts",
    hop: 2,
    what: "The verifier checks the signature, who issued it, the scope, the spend limit, the expiry date and the revocation status — then accepts or refuses.",
    why: "Trust is a calculation, not a phone call. Anything out of bounds is simply refused, and the decision is auditable afterwards.",
    checks: ["Signature", "Issuer", "Scope", "Limit", "Expiry", "Revocation"],
    web2: "The airline would trust a secret it can't attribute to anyone, and hope.",
  },
];

export function DelegationWalkthrough() {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];

  const go = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Step {index + 1} of {STEPS.length}
          </Badge>
          <h4 className="font-display text-sm font-semibold sm:text-base">
            {step.title}
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              aria-current={i === index ? "step" : undefined}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index
                  ? "w-6 bg-primary"
                  : "w-2 bg-primary/25 hover:bg-primary/50",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DelegationChain
          activeIndex={step.hop}
          completedThrough={step.hop - 1}
          hideCaption
        />

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border/60 bg-card/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What happens
            </p>
            <p className="mt-1.5 text-sm">{step.what}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Why it matters
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.why}</p>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              What's actually checked
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {step.checks.map((c) => (
                <Badge
                  key={c}
                  variant="secondary"
                  className="font-mono text-[11px]"
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">If this were web2 instead:</span>{" "}
              {step.web2}
            </span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-2 mt-5 flex items-center gap-2 rounded-lg border border-border/60 bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <Button
          variant="outline"
          size="sm"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="flex-1 sm:flex-none"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => go(index + 1)}
          disabled={index === STEPS.length - 1}
          className="flex-1 sm:flex-none"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(0)}
          className="ml-auto text-muted-foreground"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Restart
        </Button>
      </div>

      {/* Static fallback so the full explanation is readable without interaction */}
      <div className="mt-6 border-t border-border/50 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          All five hops, in order
        </p>
        <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="font-semibold text-foreground">
                {i + 1}. {s.title}
              </span>{" "}
              — {s.what}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
