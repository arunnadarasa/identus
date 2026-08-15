import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Identus Companion — build with Hyperledger Identus" },
      {
        name: "description",
        content:
          "A developer hub for Hyperledger Identus: simulated, Docker-local or Fly.io Cloud Agent, DID management, credential issuance and verification.",
      },
      { property: "og:title", content: "Identus Companion — build with Hyperledger Identus" },
      {
        property: "og:description",
        content:
          "Three agent modes, a full credential lifecycle demo and a docs portal for Hyperledger Identus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
];

function Landing() {
  // Signed-in visitors should be pointed at the console, not back at sign-in.
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signedIn = Boolean(session);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

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
            Run the full decentralised identity lifecycle — DIDs, DIDComm connections, verifiable
            credentials and proofs — against a simulated agent, your local Docker stack, or a real
            Cloud Agent you deploy to Fly.io in a few clicks.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={signedIn ? "/app" : "/auth"}>
                {signedIn ? "Go to your console" : "Start with the simulated agent"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/docs">Read the primer</Link>
            </Button>
          </div>
        </div>
      </section>



      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
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
      </section>

      <section className="border-t border-border/60 bg-card/30">
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

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:px-6 sm:py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Community project — not affiliated with the Hyperledger Foundation or the Linux
            Foundation.
          </span>
          <div className="flex items-center gap-4">
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
