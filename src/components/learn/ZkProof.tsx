import { useState } from "react";
import { EyeOff, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import { ZkProofLive } from "./ZkProofLive";

/**
 * Plain-English zero-knowledge proof explainer for the /learn page.
 * Presentational only — no server logic.
 */

const recordFields = [
  "Full name",
  "Date of birth",
  "Nationality",
  "Address",
  "Photo",
  "Over 18?",
];

const zkOpportunities = [
  {
    icon: ShieldCheck,
    title: "Prove one fact",
    body: "Age, income threshold, membership, or qualification — prove the statement is true without handing over the document that backs it.",
  },
  {
    icon: Lock,
    title: "Private compliance",
    body: "Show a regulator or partner that you've passed KYC, are accredited, or hold a licence, without exposing the PII behind it.",
  },
  {
    icon: EyeOff,
    title: "Unlinkable verification",
    body: "Each proof is fresh and uncorrelated — two verifiers checking the same credential can't join their logs to track you across services.",
  },
];

function ProofCompare() {
  const [mode, setMode] = useState<"plain" | "zk">("zk");

  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        Same question — <span className="text-foreground">"are you over 18?"</span> — two ways to answer it.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("plain")}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            mode === "plain"
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Standard credential
        </button>
        <button
          type="button"
          onClick={() => setMode("zk")}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            mode === "zk"
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Zero-knowledge proof
        </button>
      </div>

      {mode === "plain" ? (
        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            What leaves your wallet
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recordFields.map((f) => (
              <span
                key={f}
                className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-foreground"
              >
                {f}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            The verifier can see everything — name, address, date of birth, photo — even though they only needed one fact.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            What leaves your wallet
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground">
              Over 18? = true
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 font-mono text-xs text-primary">
              π (proof)
            </span>
            {recordFields.slice(0, 5).map((f) => (
              <span
                key={f}
                className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground line-through"
              >
                {f}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Verifier confirms the proof is valid — and sees nothing else.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ZkProof() {
  return (
    <div className="space-y-8">
      {/* Plain-English explainer */}
      <div className="rounded-lg border border-border/60 bg-card/30 p-5">
        <p className="text-sm text-foreground">
          A zero-knowledge proof (ZKP) is a way to prove a statement is true
          without revealing the information that makes it true. You prove you're
          old enough, or that you earn above a threshold, or that you hold a
          qualification — and the person checking learns only that single fact,
          nothing more.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          The classic analogy: imagine proving two balls are different colours
          to a friend who can't see them. You let them shuffle the balls and
          tell you whether they swapped. Do this enough times and, without ever
          revealing which ball is which, you've proved the colours differ beyond
          any doubt. A ZKP does the same thing with mathematics — and in a single
          step.
        </p>
      </div>

      {/* Interactive comparison */}
      <ProofCompare />

      {/* Real Noir proof, generated and verified in the browser */}
      <ZkProofLive />

      {/* Opportunity grid */}
      <div className="grid gap-5 sm:grid-cols-3">
        {zkOpportunities.map((o) => {
          const Icon = o.icon;
          return (
            <div
              key={o.title}
              className="rounded-lg border border-border/60 bg-card/60 p-5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 font-mono text-sm font-medium text-primary">
                {o.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{o.body}</p>
            </div>
          );
        })}
      </div>

      {/* Honest note */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">
            Where this fits today:{" "}
          </span>
          The demo above is a genuine zero-knowledge proof — a Noir circuit
          compiled in your browser and proven with Barretenberg's UltraHonk
          prover, where the birth year is a private input that never leaves the
          page. Identus credential presentations are a separate layer: the live
          console in this app issues JWT-based verifiable credentials, which do
          selective disclosure but not zero-knowledge proofs. AnonCreds and BBS+
          are the ZK-capable credential formats that let you bind a proof like
          the one above to an issued credential.
        </p>

      </div>
    </div>
  );
}
