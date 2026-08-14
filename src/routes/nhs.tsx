import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Bot, AlertTriangle } from "lucide-react";
import { SprPillars } from "@/components/nhs/SprPillars";
import { SprProblemGrid } from "@/components/nhs/SprProblemGrid";
import { CredentialMap } from "@/components/nhs/CredentialMap";
import { PatientConsentDemo } from "@/components/nhs/PatientConsentDemo";
import { DisclosureCompare } from "@/components/nhs/DisclosureCompare";

const TITLE = "NHS Single Patient Record — consent you can prove";
const DESCRIPTION =
  "How verifiable credentials answer the hard questions behind the NHS Single Patient Record: who is asking, what they may see, for how long, and how the patient can withdraw consent.";

export const Route = createFileRoute("/nhs")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NhsPage,
});

const sectionNav = [
  { id: "what", label: "What the SPR is" },
  { id: "problems", label: "Hard problems" },
  { id: "credentials", label: "Where credentials fit" },
  { id: "walkthrough", label: "Walkthrough" },
  { id: "disclosure", label: "Selective disclosure" },
  { id: "agents", label: "AI agents" },
  { id: "limits", label: "What this is not" },
];

const SPR_URL =
  "https://www.england.nhs.uk/digitaltechnology/the-single-patient-record/";

function NhsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link
            to="/"
            className="font-display min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg"
          >
            Identus<span className="text-primary">.</span>Companion
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/learn">Learn</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/docs">Docs</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app">Open console</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border/60"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24">
          <Badge
            variant="outline"
            className="mb-5 border-primary/40 text-primary sm:mb-6"
          >
            Health records · England
          </Badge>
          <h1 className="font-display max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-6xl">
            The Single Patient Record, with consent you can prove.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            NHS England is bringing a person's health information together into
            one record — visible to the patient in the NHS App and to the people
            caring for them. Joining the data up is the easy half. The harder
            half is proving, every single time, who is asking, what they are
            allowed to see, for how long, and letting the patient see and undo
            it. That is exactly what verifiable credentials are for.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href="#walkthrough">See the walkthrough</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <a href={SPR_URL} target="_blank" rel="noopener noreferrer">
                NHS England programme page
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
          <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
            Independent explainer. Not an NHS service, not affiliated with or
            endorsed by NHS England. The NHS England page linked above is the
            source of record for the programme itself.
          </p>
        </div>
      </section>

      {/* Section nav */}
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {sectionNav.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap rounded-md px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <article className="mx-auto max-w-5xl space-y-16 px-4 py-14 sm:space-y-24 sm:px-6 sm:py-20">
        {/* What the SPR is */}
        <section id="what" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            The programme
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            What the Single Patient Record is
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Today a person's health information is spread across the systems of
            whoever happened to treat them: their GP practice, one or more
            hospitals, community services, pharmacy, social care. Each holds a
            fragment, and moving a fragment between them is slow, manual, and
            often falls to the patient to carry. The Single Patient Record is
            the plan to change that.
          </p>
          <div className="mt-8">
            <SprPillars />
          </div>
        </section>

        {/* Hard problems */}
        <section id="problems" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            The hard half
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Four questions a joined-up record has to answer
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            The more useful a record is, the more valuable it becomes to reach
            into. Every one of these questions has to be answered at the moment
            of care, in seconds, across organisational boundaries — and answered
            in a way a patient would find reasonable if they read the log.
          </p>
          <div className="mt-8">
            <SprProblemGrid />
          </div>
        </section>

        {/* Where credentials fit */}
        <section id="credentials" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            The pattern
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Where verifiable credentials fit
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            A verifiable credential is a signed statement — issued by someone
            with the authority to make it, held by the person or organisation it
            is about, and checkable by anyone without calling the issuer. Four
            credential types cover the questions above, and none of them require
            a central database of consents.
          </p>
          <div className="mt-8">
            <CredentialMap />
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            None of this replaces the record itself. It sits in front of it:
            identity, authority and consent become portable proofs, so each
            organisation checks a signature instead of trusting a shared login
            or asking a central service for permission.
          </p>
        </section>

        {/* Walkthrough */}
        <section id="walkthrough" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            Walk through it
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            One request, end to end
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            A late-night dispensing check is the ordinary case that shows every
            moving part. Click through it — each step shows what the patient
            sees, and you can open the technical detail underneath.
          </p>
          <div className="mt-8">
            <PatientConsentDemo />
          </div>
        </section>

        {/* Selective disclosure */}
        <section id="disclosure" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            Minimum necessary
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Selective disclosure in practice
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            "Minimum necessary" is already the expectation in information
            governance. Credentials make it enforceable at the point of the
            request rather than a rule people are asked to remember.
          </p>
          <div className="mt-8">
            <DisclosureCompare />
          </div>
        </section>

        {/* AI agents */}
        <section id="agents" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            What is coming
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            When the thing asking is an AI agent
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Care navigation, triage support and admin automation all point the
            same way: software will start making requests on a person's behalf.
            An agent cannot be "logged in as the patient" — that collapses the
            audit trail and makes consent meaningless. It needs its own
            identifier, a mandate showing who delegated what, and a grant that
            is scoped and revocable like any other.
          </p>
          <div className="mt-8 rounded-lg border border-border/60 bg-card/30 p-5 sm:p-6">
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The console already runs this end to end on open protocols: agents
              exchanging signed messages, credential-gated decisions, wallet-signed
              mandates that bind an agent to exactly what it was authorised to do,
              and machine-verifiable responses. Same primitives, different
              domain — worth seeing before designing agent access to a health
              record.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link to="/app/demos">Run the agentic demos</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/learn" hash="agents">
                  Read the background
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Limits */}
        <section
          id="limits"
          className="scroll-mt-16 rounded-lg border border-border/60 bg-card/30 p-6 sm:p-10"
        >
          <AlertTriangle
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            What this page is not
          </h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              Not an NHS product, and not affiliated with or endorsed by NHS
              England. For the programme itself, read the{" "}
              <a
                href={SPR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                NHS England Single Patient Record page
              </a>
              .
            </li>
            <li>
              Not clinical advice, and not a description of how any specific
              trust or supplier has implemented access control.
            </li>
            <li>
              No real patient data anywhere in this app. The walkthrough is a
              fictional scenario running entirely in your browser, and the
              console issues clearly-labelled demo credentials.
            </li>
            <li>
              Not a claim that credentials are the only answer. They address
              identity, authority and consent — not data quality, interoperable
              clinical coding, or the governance work around either.
            </li>
          </ul>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/app">Open the console</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/learn">Learn the basics</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link to="/docs">Developer docs</Link>
            </Button>
          </div>
        </section>
      </article>
    </main>
  );
}
