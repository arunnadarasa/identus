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

      <section
        className="relative overflow-hidden border-b border-border/60"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24">
          <Badge variant="outline" className="mb-5 border-primary/40 text-primary sm:mb-6">
            Self-sovereign identity toolkit
          </Badge>
          <h1 className="font-display max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Learn and operate Hyperledger Identus without the setup tax.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Run a real Cloud Agent — simulated, on Docker, or deployed to Fly.io in a few clicks.
            Prove claims from issued credentials with zero-knowledge proofs in the browser. Let AI
            agents transact under a delegation credential they have to earn.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Beyond the basics</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The console goes past DIDs and credentials — these three panels are where the newer work
          lives.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="font-display pt-2">Zero-knowledge proofs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Pick a credential you actually hold and prove “over 18” with a Noir circuit running
                in your browser — the date of birth never leaves the page, only the proof does.
              </p>
              <Link
                to={signedIn ? "/app/zk" : "/auth"}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Open the ZK panel <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="font-display pt-2">Agentic commerce</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                A2A, AP2, UCP and x402 on Base Sepolia. The payment only settles when the agent's
                delegation credential and its principal's identity both pass the Identus gate.
              </p>
              <Link
                to={signedIn ? "/app/demos" : "/auth"}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Run the demos <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <TerminalSquare className="h-5 w-5 text-primary" />
              <CardTitle className="font-display pt-2">SDK sandbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Your own scratch box with runnable Identus TypeScript snippets, a Docker Compose lab
                and a quickstart for delegation credentials — no agent stack required.
              </p>
              <Link
                to={signedIn ? "/app/sandbox" : "/auth"}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Open the sandbox <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Three agent modes</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Switch mode at any time — the console keeps the same workflows, only the backing agent
            changes.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {modes.map((mode) => (
              <Card key={mode.name} className="border-border/60 bg-card/60">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit font-mono text-xs">
                    {mode.tag}
                  </Badge>
                  <CardTitle className="font-display pt-2">{mode.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{mode.body}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            What you can do in the console
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(([title, body]) => (
              <div key={title} className="border-l-2 border-primary/50 pl-4">
                <h3 className="font-mono text-sm font-medium text-primary">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Learn the concepts</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Card className="border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="font-display">Self-sovereign identity, explained</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  No jargon: what changes for web2 and web3, how the trust triangle works, and
                  interactive walkthroughs of credential issuance, AI-agent delegation and
                  zero-knowledge proofs.
                </p>
                <Link
                  to="/learn"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Read the guide <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="font-display">NHS single patient record</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  A worked example of what NHS England's single patient record could look like when
                  the patient holds verifiable credentials instead of every service holding a copy.
                </p>
                <Link
                  to="/nhs"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  See the scenario <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
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
