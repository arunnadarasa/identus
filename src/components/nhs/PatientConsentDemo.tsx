import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, Clock, Ban, Eye } from "lucide-react";

type Step = {
  id: string;
  actor: string;
  title: string;
  body: string;
  audit: string;
  detail: string;
  action: string;
  tone: "neutral" | "consent" | "verified" | "revoked";
};

const steps: Step[] = [
  {
    id: "request",
    actor: "Pharmacist",
    title: "A request arrives",
    body: "It is 21:40. An out-of-hours pharmacist needs to know what Priya is currently taking before dispensing. Instead of asking for the whole record, the request names exactly what it needs.",
    detail:
      "Presentation request · fields: current_medications, known_allergies · purpose: dispensing safety check · requested window: 4 hours",
    audit: "Request received — medication history, dispensing safety check.",
    action: "Show Priya the request",
    tone: "neutral",
  },
  {
    id: "review",
    actor: "Priya's wallet",
    title: "Priya sees what is being asked",
    body: "Her wallet shows the two fields requested, who is asking, why, and for how long — in plain language, before anything is shared. Nothing has left her wallet yet.",
    detail:
      "Verifier: registered pharmacy, named organisation · fields shown to Priya: 2 of 47 available · nothing disclosed yet",
    audit: "Priya viewed the request. No data released.",
    action: "Priya consents",
    tone: "neutral",
  },
  {
    id: "consent",
    actor: "Priya",
    title: "Consent becomes a credential",
    body: "Her approval is not a checkbox in someone else's database. It is a signed grant she holds, naming the scope, the purpose and an expiry — and she can withdraw it.",
    detail:
      "Care-relationship grant issued · scope: current_medications, known_allergies · expires: +4h · revocable: yes",
    audit: "Consent granted by patient — scoped, expires in 4 hours.",
    action: "Check the pharmacist's credentials",
    tone: "consent",
  },
  {
    id: "verify",
    actor: "Verifier",
    title: "The pharmacist proves their side too",
    body: "Consent alone is not enough. Before the record opens, the pharmacist's professional role credential is checked — registration, role, organisation, and whether it has been revoked.",
    detail:
      "Role credential verified · signature: valid · registration: active · revocation status: not revoked · issuer trusted",
    audit: "Pharmacist role credential verified against issuer.",
    action: "Release the two fields",
    tone: "verified",
  },
  {
    id: "access",
    actor: "Record",
    title: "Two fields, four hours",
    body: "The pharmacist sees the current medications and allergies — and nothing else. The permission carries its own expiry, so it closes without anyone remembering to close it.",
    detail:
      "Disclosed: 2 fields · withheld: 45 fields · access expires automatically at 01:40 · audit entry written to Priya's timeline",
    audit: "2 fields disclosed. Access will expire at 01:40.",
    action: "Priya withdraws consent later",
    tone: "verified",
  },
  {
    id: "revoke",
    actor: "Priya",
    title: "Withdrawal that actually takes effect",
    body: "A week later Priya revokes the grant from her app. The revocation is published, so the next verification fails everywhere — there is no copy of the permission still quietly working in another system.",
    detail:
      "Grant revoked · status list updated · subsequent verification result: invalid (revoked) · previously written audit entries retained",
    audit: "Consent withdrawn by patient. Grant now fails verification.",
    action: "Start again",
    tone: "revoked",
  },
];

const toneRing: Record<Step["tone"], string> = {
  neutral: "border-border/60",
  consent: "border-primary/50",
  verified: "border-primary/50",
  revoked: "border-destructive/50",
};

export function PatientConsentDemo() {
  const [index, setIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6">
      {/* Progress */}
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setShowDetail(false);
              }}
              aria-current={i === index ? "step" : undefined}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                i === index
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : i < index
                    ? "border-border/60 bg-muted/40 text-muted-foreground"
                    : "border-border/60 bg-transparent text-muted-foreground/70"
              }`}
            >
              {i < index ? (
                <Check className="mr-1 inline h-3 w-3" aria-hidden="true" />
              ) : null}
              {i + 1}. {s.actor}
            </button>
          </li>
        ))}
      </ol>

      {/* Current step */}
      <div className={`mt-5 rounded-lg border bg-background/60 p-4 sm:p-5 ${toneRing[step.tone]}`}>
        <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
          Step {index + 1} of {steps.length} · {step.actor}
        </p>
        <h3 className="font-display mt-2 text-lg font-semibold tracking-tight">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground underline decoration-dotted hover:text-foreground"
        >
          {showDetail ? "Hide technical detail" : "Show technical detail"}
        </button>
        {showDetail ? (
          <p className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {step.detail}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setShowDetail(false);
              setIndex(isLast ? 0 : index + 1);
            }}
          >
            {step.action}
          </Button>
          {index > 0 ? (
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setShowDetail(false);
                setIndex(index - 1);
              }}
            >
              Back
            </Button>
          ) : null}
        </div>
      </div>

      {/* Audit trail */}
      <div className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          What Priya sees in her audit trail
        </p>
        <ul className="mt-2 space-y-1.5">
          {steps.slice(0, index + 1).map((s, i) => {
            const Icon =
              s.tone === "revoked"
                ? Ban
                : s.tone === "verified"
                  ? ShieldCheck
                  : s.tone === "consent"
                    ? Check
                    : i === 1
                      ? Eye
                      : Clock;
            return (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    s.tone === "revoked" ? "text-destructive" : "text-primary"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{s.audit}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
