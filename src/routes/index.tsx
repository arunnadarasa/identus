import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, ShieldCheck, Bot, TerminalSquare, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MarketingHeader } from "@/components/MarketingHeader";
import { HeroArtifact } from "@/components/marketing/HeroArtifact";
import { PremiumCard } from "@/components/marketing/PremiumCard";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Identus Companion — Identus, ZK proofs and agentic demos" },
      {
        name: "description",
        content:
          "Developer hub for Hyperledger Identus: simulated, Docker-local or Fly.io Cloud Agent, credential issuance, browser zero-knowledge proofs and AI-agent commerce demos.",
      },
      {
        property: "og:title",
        content: "Identus Companion — Identus, ZK proofs and agentic demos",
      },
      {
        property: "og:description",
        content:
          "Three agent modes, the full credential lifecycle, Noir zero-knowledge proofs in the browser and A2A/AP2/UCP/x402 demos for delegated AI agents.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://identus.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://identus.lovable.app/" }],
  }),
  component: Landing,
});

const modes = [
  {
    name: "Simulated",
    tag: "Zero setup",
    body: "A deterministic in-app agent that mirrors the Cloud Agent REST semantics. Issue, hold and verify credentials instantly.",
  },
  {
    name: "Docker local",
    tag: "Your machine",
    body: "Point the app at a Cloud Agent running from the Identus Docker Compose stack on localhost and drive it over REST.",
  },
  {
    name: "Fly.io",
    tag: "Real deployment",
    body: "Provision Postgres, a PRISM node and the Cloud Agent as Fly machines with your organisation token, straight from the wizard.",
  },
];

const capabilities = [
  ["DID registrar", "Create and publish did:prism identifiers with issuer, holder or verifier roles."],
  ["DIDComm connections", "Generate out-of-band invitations and walk the connection state machine."],
  ["Credential issuance", "Offer, accept and store W3C JWT verifiable credentials against a schema."],
  ["Presentation & proof", "Request a presentation and inspect each verification check individually."],
  ["Schema registry", "Define credential schemas with versioned attribute sets."],
  ["Activity trail", "Every protocol step is logged so you can trace exactly what the agent did."],
  [
    "Delegation credentials",
    "Issue a mandate that lets an AI agent act for a human, with scope and spend limits baked in.",
  ],
  [
    "ZK-bound presentations",
    "Commit to a real issued credential and prove a predicate about it without disclosing the claim.",
  ],
  [
    "Snippet library",
    "Runnable Identus TypeScript snippets and a Compose lab in your own sandbox, versioned as the SDK moves.",
  ],
];

function Landing() {
  // Signed-in visitors should be pointed at the console, not back at sign-in.
  const { session } = useAuth();
  const signedIn = Boolean(session);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketingHeader maxWidth="6xl" linkHome={false} />

      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-hero">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] [background-size:64px_64px]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="animate-rise">
            <Badge variant="outline" className="mb-5 border-primary/40 text-primary sm:mb-6">
              Self-sovereign identity toolkit
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
              Learn and operate{" "}
              <span className="text-gradient">Hyperledger Identus</span> without the setup tax.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Run a real Cloud Agent — simulated, on Docker, or deployed to Fly.io in a few clicks.
              Prove claims from issued credentials with zero-knowledge proofs in the browser. Let AI
              agents transact under a delegation credential they have to earn.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                className="w-full bg-gradient-primary shadow-float transition-transform duration-300 hover:scale-[1.02] sm:w-auto"
              >
                <Link to={signedIn ? "/app" : "/auth"}>
                  {signedIn ? "Go to your console" : "Start with the simulated agent"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to="/docs">Read the primer</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
                <Link to="/learn">New to SSI? Start here</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border/60 pt-6">
              {[
                ["3", "agent modes"],
                ["4", "agentic protocols"],
                ["0", "claims disclosed"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-semibold text-primary">{value}</dt>
                  <dd className="text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <HeroArtifact />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow="In the console"
          title="Beyond the basics"
          lead="The console goes past DIDs and credentials — these three panels are where the newer work lives."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <PremiumCard
            icon={ShieldCheck}
            eyebrow="Noir circuit"
            title="Zero-knowledge proofs"
            to={signedIn ? "/app/zk" : "/auth"}
            cta="Open the ZK panel"
          >
            Pick a credential you actually hold and prove “over 18” with a Noir circuit running in
            your browser — the date of birth never leaves the page, only the proof does.
          </PremiumCard>

          <PremiumCard
            icon={Bot}
            eyebrow="A2A · AP2 · UCP · x402"
            title="Agentic commerce"
            to={signedIn ? "/app/demos" : "/auth"}
            cta="Run the demos"
          >
            Settlement on Base Sepolia only happens when the agent's delegation credential and its
            principal's identity both pass the Identus gate.
          </PremiumCard>

          <PremiumCard
            icon={TerminalSquare}
            eyebrow="Scratch box"
            title="SDK sandbox"
            to={signedIn ? "/app/sandbox" : "/auth"}
            cta="Open the sandbox"
          >
            Runnable Identus TypeScript snippets, a Docker Compose lab and a quickstart for
            delegation credentials — no agent stack required.
          </PremiumCard>
        </div>
      </section>

      <section className="relative border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Choose your backend"
            title="Three agent modes"
            lead="Switch mode at any time — the console keeps the same workflows, only the backing agent changes."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {modes.map((mode, index) => (
              <div
                key={mode.name}
                className="glass hover-lift rounded-xl p-5 shadow-elegant"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {mode.tag}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{mode.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mode.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="Capabilities" title="What you can do in the console" />
          <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(([title, body]) => (
              <div
                key={title}
                className="group border-l-2 border-primary/40 pl-4 transition-colors duration-300 hover:border-primary"
              >
                <h3 className="font-mono text-sm font-medium text-primary">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="Context" title="Learn the concepts" />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <PremiumCard
              title="Self-sovereign identity, explained"
              to="/learn"
              cta="Read the guide"
            >
              No jargon: what changes for web2 and web3, how the trust triangle works, and
              interactive walkthroughs of credential issuance, AI-agent delegation and
              zero-knowledge proofs.
            </PremiumCard>
            <PremiumCard title="NHS single patient record" to="/nhs" cta="See the scenario">
              A worked example of what NHS England's single patient record could look like when the
              patient holds verifiable credentials instead of every service holding a copy.
            </PremiumCard>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:px-6 sm:py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Community project — not affiliated with the Hyperledger Foundation or the Linux
            Foundation.
          </span>

          <div className="flex flex-wrap items-center gap-4">
            <Link className="text-primary hover:underline" to="/learn">
              Learn
            </Link>
            <a
              className="text-primary hover:underline"
              href="https://identus.io/documentation/develop/"
              target="_blank"
              rel="noreferrer"
            >
              identus.io documentation
            </a>
            <a
              className="text-primary hover:underline"
              href="https://github.com/arunnadarasa/identus"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="inline h-4 w-4" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
