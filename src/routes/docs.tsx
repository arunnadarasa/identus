import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Identus primer & docs — Identus Companion" },
      {
        name: "description",
        content:
          "A practical primer on Hyperledger Identus: Cloud Agent, PRISM DIDs, DIDComm mediation, verifiable credentials and the TypeScript SDK.",
      },
      { property: "og:title", content: "Identus primer & docs — Identus Companion" },
      {
        property: "og:description",
        content:
          "Understand the Identus stack: Cloud Agent, PRISM DIDs, mediator, credentials and SDKs.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Docs,
});

const stack = [
  {
    name: "Cloud Agent",
    body: "A Scala service exposing a REST API for DID management, DIDComm connections, credential issuance and proof presentation. Backed by Postgres and a PRISM node.",
    link: "https://github.com/hyperledger-identus/cloud-agent",
  },
  {
    name: "PRISM node",
    body: "Anchors DID operations to a ledger (or an in-memory ledger for development) and answers DID resolution requests for did:prism.",
    link: "https://github.com/hyperledger-identus/hyperledger-identus",
  },
  {
    name: "Mediator",
    body: "Stores and forwards DIDComm messages for mobile or intermittently connected wallets that cannot hold an inbound endpoint.",
    link: "https://github.com/hyperledger-identus/mediator",
  },
  {
    name: "SDKs",
    body: "Edge-agent SDKs for TypeScript, Kotlin Multiplatform and Swift let wallets hold keys, store credentials and speak DIDComm directly.",
    link: "https://github.com/hyperledger-identus/sdk-ts",
  },
];

const flow = [
  ["1 · Create DIDs", "The issuer publishes a did:prism with an assertion key; the holder creates one for authentication."],
  ["2 · Connect", "The issuer creates an out-of-band invitation. The holder accepts it and both sides exchange peer DIDs over DIDComm."],
  ["3 · Offer", "The issuer sends a credential offer referencing a schema and the claims it will attest."],
  ["4 · Accept & issue", "The holder accepts the offer; the agent signs a W3C JWT verifiable credential and delivers it to the wallet."],
  ["5 · Present & verify", "A verifier requests a presentation. The holder responds and the verifier checks signature, issuer DID and revocation status."],
];

const endpoints = [
  ["POST", "/did-registrar/dids", "Create a new managed DID"],
  ["POST", "/connections", "Create a DIDComm out-of-band invitation"],
  ["POST", "/issue-credentials/credential-offers", "Offer a verifiable credential"],
  ["POST", "/present-proof/presentations", "Request a presentation from a holder"],
  ["GET", "/_system/health", "Agent health and version"],
];

const hostingComparison = [
  {
    feature: "Container image execution",
    fly: "Yes — runs identus/identus-cloud-agent and identus/prism-node images",
    docker: "Yes — full Docker Compose stack on localhost",
    sprites: "No — sprites.dev runs a single Linux box, not container images",
  },
  {
    feature: "Multi-service composition",
    fly: "Yes — separate Machines for Postgres, PRISM node and Cloud Agent",
    docker: "Yes — Compose orchestrates all services",
    sprites: "No — one command at a time, no Compose-like service grouping",
  },
  {
    feature: "Managed Postgres + private network",
    fly: "Yes — Fly Postgres with internal 6PN IPs and 4 databases",
    docker: "Yes — local Postgres on the Docker network",
    sprites: "No — no managed Postgres or private service networking",
  },
  {
    feature: "Long-running agent service",
    fly: "Yes — Machines stay up and expose HTTPS endpoints",
    docker: "Yes — containers run continuously while Docker is active",
    sprites: "No — exec commands are short-lived; no persistent service model",
  },
  {
    feature: "SDK snippet sandbox",
    fly: "Not designed for ad-hoc code",
    docker: "Possible but manual",
    sprites: "Yes — per-user Node box with the Identus TypeScript SDK",
  },
];

function Docs() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link to="/" className="font-display min-w-0 truncate text-base sm:text-lg font-semibold tracking-tight">
            Identus<span className="text-primary">.</span>Companion
          </Link>
          <Button asChild size="sm">
            <Link to="/app">Open console</Link>
          </Button>
        </div>
      </header>

      <article className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-16">
        <section>
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            Primer
          </Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            How Hyperledger Identus fits together
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Identus is a set of components for building self-sovereign identity systems: agents that
            hold keys and speak DIDComm, a node that anchors DID operations, and SDKs for edge
            wallets. This page summarises the moving parts; the official documentation is the
            authoritative reference.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="https://identus.io/documentation/develop/" target="_blank" rel="noreferrer">
              identus.io/documentation
            </a>
          </Button>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">The stack</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {stack.map((item) => (
              <Card key={item.name} className="border-border/60 bg-card/60">
                <CardHeader>
                  <CardTitle className="font-display text-lg">{item.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{item.body}</p>
                  <a
                    className="inline-block font-mono text-xs text-primary hover:underline"
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    source →
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            The credential lifecycle
          </h2>
          <div className="mt-6 space-y-4">
            {flow.map(([title, body]) => (
              <div key={title} className="border-l-2 border-primary/50 pl-4">
                <h3 className="font-mono text-sm font-medium text-primary">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Cloud Agent endpoints used by this app
          </h2>
          <div className="mt-6 overflow-hidden rounded-md border border-border/60">
            {endpoints.map(([method, path, desc]) => (
              <div
                key={path}
                className="flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-3 text-sm last:border-0"
              >
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {method}
                </Badge>
                <code className="font-mono text-xs text-primary">{path}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Where to run an Identus Cloud Agent
          </h2>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            The Cloud Agent ships as container images and needs a Postgres instance with several
            databases on a private network. That shapes which hosts can run the full stack versus
            which are only suitable for code snippets.
          </p>

          <div className="mt-6 overflow-hidden rounded-md border border-border/60">
            <div className="grid grid-cols-4 gap-px bg-border/60">
              <div className="bg-secondary/40 px-4 py-3 text-xs font-medium text-foreground">Capability</div>
              <div className="bg-secondary/40 px-4 py-3 text-xs font-medium text-foreground">Fly Machines</div>
              <div className="bg-secondary/40 px-4 py-3 text-xs font-medium text-foreground">Docker local</div>
              <div className="bg-secondary/40 px-4 py-3 text-xs font-medium text-foreground">Sprites.dev</div>
              {hostingComparison.flatMap((row) => [
                <div key={`${row.feature}-f`} className="bg-card/60 px-4 py-3 text-sm text-foreground">
                  {row.feature}
                </div>,
                <div key={`${row.feature}-fly`} className="bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  {row.fly}
                </div>,
                <div key={`${row.feature}-docker`} className="bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  {row.docker}
                </div>,
                <div key={`${row.feature}-sprites`} className="bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  {row.sprites}
                </div>,
              ])}
            </div>
          </div>

          <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Recommendation: use Fly Machines for Cloud Agents.</strong>{" "}
            A real Identus Cloud Agent needs Postgres, a PRISM node and the agent service running
            together with a public HTTPS endpoint. Fly Machines supports this multi-service
            composition, private networking and health checks out of the box.
          </div>

          <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Sprites.dev is only the SDK sandbox.</strong>{" "}
            It cannot host the Cloud Agent because it has no container image execution, no
            multi-service composition and no managed Postgres. The companion app uses it instead as a
            per-user scratch box: each account gets a private sprite with Node and the Identus
            TypeScript SDK installed, and snippets run there with the active agent&apos;s base URL and
            admin key injected as environment variables.
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Running an agent</h2>
          <div className="mt-6 space-y-6 text-sm text-muted-foreground">
            <div>
              <h3 className="font-mono text-sm text-foreground">Docker on your machine</h3>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`git clone https://github.com/hyperledger-identus/cloud-agent
 cd cloud-agent/infrastructure/local
 ./run.sh            # agent on http://localhost:8085/cloud-agent`}
              </pre>
            </div>
            <div>
              <h3 className="font-mono text-sm text-foreground">Fly.io, from the console</h3>
              <p className="mt-2">
                The Agents page provisions a Fly app with three machines — Postgres, a PRISM node and
                the Cloud Agent — using your Fly organisation token, then stores the generated API
                key so the console can talk to it over HTTPS.
              </p>
            </div>
            <div>
              <h3 className="font-mono text-sm text-foreground">Simulated</h3>
              <p className="mt-2">
                No infrastructure. The app performs the same workflow deterministically so you can
                learn the protocol shape before deploying anything.
              </p>
            </div>
          </div>
        </section>
      </article>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 text-sm text-muted-foreground">
          Community project — not affiliated with the Hyperledger Foundation or the Linux Foundation.
        </div>
      </footer>
    </main>
  );
}
