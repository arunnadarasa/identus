import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TruncatedMono, shortenId } from "@/components/MonoValue";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  EyeOff,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type Claim = { key: string; value: string };

type Sample = {
  id: string;
  name: string;
  issuer: string;
  claims: Claim[];
  /** claim keys the verifier actually needs */
  requested: string[];
  ask: string;
  verifier: string;
};

const SAMPLES: Sample[] = [
  {
    id: "student",
    name: "Student ID",
    issuer: "Acme University",
    claims: [
      { key: "name", value: "Alice Doe" },
      { key: "studentNumber", value: "AU-208114" },
      { key: "programme", value: "Computer Science" },
      { key: "validUntil", value: "2027-06-30" },
    ],
    requested: ["studentNumber", "validUntil"],
    ask: "Prove you are an enrolled student",
    verifier: "City Transport (student fare)",
  },
  {
    id: "over18",
    name: "Over 18",
    issuer: "Acme University",
    claims: [
      { key: "name", value: "Alice Doe" },
      { key: "dateOfBirth", value: "1999-03-12" },
      { key: "over18", value: "true" },
      { key: "nationality", value: "IE" },
    ],
    requested: ["over18"],
    ask: "Prove you are over 18",
    verifier: "The Blue Door (bar entrance)",
  },
];

const HOLDER_DID = "did:prism:5f2a9c7e1b4d8a3f6e0c2b9d7a41f83b";
const ISSUER_DID = "did:prism:1c4e7a90d2b56f83ac19e740b5d3f621";
const FAKE_JWT =
  "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJkaWQ6cHJpc206MWM0ZTdhOTBkMmI1NmY4M2FjMTllNzQwYjVkM2Y2MjEiLCJzdWIiOiJkaWQ6cHJpc206NWYyYTljN2UxYjRkOGEzZjZlMGMyYjlkN2E0MWY4M2IiLCJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJvdmVyMTgiOnRydWV9fX0.MEUCIQDf7pQb2sVn3xTaR9wKcYq1LmZ0hEoUvBnG4sJdA6yPxwIgWq3kNfR8tGmC1uYbHo2ZpLxvD9sQeK7iA0nMcRtBjU4";

const STEPS = [
  {
    key: "offer",
    label: "Issuer offers",
    caption:
      "Acme University signs a credential about Alice and sends her an offer. Nothing is published about her anywhere.",
    technical:
      "The issuer creates a verifiable credential signed with the assertion key of its published DID, then delivers an offer over DIDComm (or a connectionless invitation URL).",
  },
  {
    key: "accept",
    label: "Holder accepts",
    caption:
      "Alice accepts. The credential now lives in her wallet, on her device — not in a company database.",
    technical:
      "The holder's agent stores the signed credential (a JWT VC here) bound to her own DID as the subject.",
  },
  {
    key: "ask",
    label: "Verifier asks",
    caption:
      "Someone needs to check one thing about Alice. They ask only for what they need.",
    technical:
      "The verifier sends a presentation request naming the required claims and accepted issuers.",
  },
  {
    key: "prove",
    label: "Holder proves",
    caption:
      "Alice approves the request. Only the requested facts leave her wallet — the rest stays hidden.",
    technical:
      "The holder builds a verifiable presentation containing the credential proof and the disclosed claims, signed with her DID key.",
  },
  {
    key: "verified",
    label: "Verified",
    caption:
      "The verifier checks the maths, not a phone call to the university. Seconds, no paperwork, no stored copy.",
    technical:
      "The verifier resolves the issuer DID, checks the signature, expiry and revocation status, and validates holder binding — all offline against the ledger-anchored DID document.",
  },
] as const;

function ClaimRow({
  claim,
  state,
}: {
  claim: Claim;
  state: "normal" | "requested" | "hidden" | "shared";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition-colors duration-300",
        state === "normal" && "border-border/50 bg-secondary/30",
        state === "requested" &&
          "border-primary/50 bg-primary/10 text-foreground",
        state === "shared" && "border-primary/50 bg-primary/10",
        state === "hidden" &&
          "border-dashed border-border/40 bg-transparent text-muted-foreground/50",
      )}
    >
      <span className="font-mono">{claim.key}</span>
      <span className="min-w-0 truncate font-mono">
        {state === "hidden" ? "•••••" : claim.value}
      </span>
    </div>
  );
}

function Lane({
  title,
  subtitle,
  icon: Icon,
  active,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Wallet;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-4 transition-all duration-300",
        active
          ? "border-primary/50 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
          : "border-border/50 bg-card/40 opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
            active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 bg-secondary/40 text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children ? <div className="mt-4 space-y-2">{children}</div> : null}
    </div>
  );
}

export function CredentialDemo() {
  const [sampleId, setSampleId] = useState(SAMPLES[1]!.id);
  const [step, setStep] = useState(0);
  const [showTech, setShowTech] = useState(false);

  const sample = useMemo(
    () => SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!,
    [sampleId],
  );
  const current = STEPS[step]!;

  const holderHasCard = step >= 1;
  const shared = sample.claims.filter((c) => sample.requested.includes(c.key));

  const claimState = (claim: Claim): "normal" | "requested" | "hidden" => {
    if (step >= 2 && !sample.requested.includes(claim.key)) return "hidden";
    if (step >= 2) return "requested";
    return "normal";
  };

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Interactive
          </Badge>
          <span className="text-xs text-muted-foreground">
            Nothing here touches a real agent — it's a safe walkthrough.
          </span>
        </div>
        <CardTitle className="font-display text-lg">
          Issue and verify a credential, step by step
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={s.id === sampleId ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                setSampleId(s.id);
                setStep(0);
              }}
            >
              {s.name}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stepper */}
        <ol className="grid grid-cols-5 gap-1" aria-label="Demo progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="min-w-0">
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "w-full min-w-0 rounded-md border px-1.5 py-2 text-center transition-colors",
                  i === step
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : i < step
                      ? "border-border/50 bg-secondary/40 text-muted-foreground"
                      : "border-border/40 text-muted-foreground/60",
                )}
              >
                <span className="block font-mono text-[10px]">{i + 1}</span>
                <span className="mt-0.5 block truncate text-[10px] sm:text-xs">
                  {s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {/* Lanes */}
        <div className="grid gap-4 md:grid-cols-3">
          <Lane
            title={sample.issuer}
            subtitle="Issuer"
            icon={Building2}
            active={step === 0}
          >
            <p className="text-xs text-muted-foreground">
              Signing DID
            </p>
            <p className="break-all font-mono text-[11px] text-muted-foreground">
              {shortenId(ISSUER_DID, 6, 6)}
            </p>
            {step === 0 ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
                <p className="flex items-center gap-2 font-medium">
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Offer sent: {sample.name}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Offer delivered. The issuer keeps no record of where Alice uses
                it.
              </p>
            )}
          </Lane>

          <Lane
            title="Alice's wallet"
            subtitle="Holder"
            icon={Wallet}
            active={step === 1 || step === 3}
          >
            <p className="break-all font-mono text-[11px] text-muted-foreground">
              {shortenId(HOLDER_DID, 6, 6)}
            </p>
            {holderHasCard ? (
              <div className="space-y-2 rounded-md border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <BadgeCheck
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                    {sample.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    JWT VC
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {sample.claims.map((c) => (
                    <ClaimRow key={c.key} claim={c} state={claimState(c)} />
                  ))}
                </div>
                {step >= 2 ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <EyeOff className="h-3 w-3" aria-hidden="true" />
                    Hidden claims never leave the wallet
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Empty — waiting for the offer.
              </p>
            )}
            {step === 3 ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
                Sharing {shared.length} claim{shared.length === 1 ? "" : "s"}:{" "}
                <span className="font-mono">
                  {sample.requested.join(", ")}
                </span>
              </div>
            ) : null}
          </Lane>

          <Lane
            title={sample.verifier}
            subtitle="Verifier"
            icon={ShieldCheck}
            active={step === 2 || step === 4}
          >
            {step < 2 ? (
              <p className="text-xs text-muted-foreground">
                Not involved yet.
              </p>
            ) : step < 4 ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
                <p className="font-medium">{sample.ask}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  requested: {sample.requested.join(", ")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-md border border-primary/50 bg-primary/10 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Verified
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    <li>Signature valid (issuer key resolved from DID)</li>
                    <li>Issuer recognised: {sample.issuer}</li>
                    <li>Not expired</li>
                    <li>Not revoked</li>
                  </ul>
                </div>
                <div className="rounded-md border border-dashed border-border/50 p-3 text-[11px] text-muted-foreground">
                  Not revealed:{" "}
                  <span className="font-mono">
                    {sample.claims
                      .filter((c) => !sample.requested.includes(c.key))
                      .map((c) => c.key)
                      .join(", ")}
                  </span>
                </div>
              </div>
            )}
          </Lane>
        </div>

        {/* Caption + controls */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/20 p-4">
          <p className="text-sm">
            <span className="font-medium">
              Step {step + 1} · {current.label}.{" "}
            </span>
            <span className="text-muted-foreground">{current.caption}</span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setShowTech((v) => !v)}
          >
            {showTech ? "Hide" : "What's happening technically?"}
          </Button>
          {showTech ? (
            <p className="text-xs text-muted-foreground">{current.technical}</p>
          ) : null}
          {showTech && step >= 1 ? (
            <TruncatedMono
              value={FAKE_JWT}
              label="The credential, as a signed JWT (sample)"
              copy={false}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              {step === 3 ? "Share and verify" : "Next"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={() => setStep(0)}
            >
              Start over
            </Button>
          )}
          <Button asChild variant="ghost" className="flex-1 sm:flex-none">
            <Link to="/app/credentials">Do this for real in the console</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
