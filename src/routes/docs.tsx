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
    docker: "Yes — the same pinned images, run locally by Compose",
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
    docker: "Yes — but localhost only; external DIDComm peers need a tunnel",
    sprites: "No — exec commands are short-lived; no persistent service model",
  },
  {
    feature: "SDK snippet sandbox",
    fly: "Not designed for ad-hoc code",
    docker: "Possible but manual",
    sprites: "Yes — per-user Node box with the Identus TypeScript SDK",
  },
];

const dockerEnv: Array<[string, string, string]> = [
  ["AGENT_PORT", "8085", "Host port for the Cloud Agent REST API (/cloud-agent)."],
  ["DIDCOMM_PORT", "8090", "Host port for the agent's DIDComm endpoint."],
  ["PRISM_NODE_PORT", "50053", "Host port for the PRISM node's gRPC API."],
  ["POSTGRES_PORT", "5432", "Host port for Postgres — change it if you already run one."],
  ["POSTGRES_USER", "postgres", "Owner of the pollux, connect, agent and node databases."],
  ["POSTGRES_PASSWORD", "postgres", "Database password; change it for anything shared."],
  ["ADMIN_TOKEN", "local-admin-token", "Admin API key. This is what the console stores."],
  ["DEFAULT_WALLET_AUTH_API_KEY", "local-admin-token", "API key for the default wallet; keep it equal to ADMIN_TOKEN."],
];

const dockerTroubleshooting: Array<[string, string, string]> = [
  [
    'Error: bind: address already in use',
    "Another process (often a local Postgres, or a previous stack) already holds that host port.",
    "Change the host side in .env — e.g. POSTGRES_PORT=5433 — then docker compose up -d --wait. Find the culprit with lsof -i :5432.",
  ],
  [
    "cloud-agent restarts in a loop",
    "Its schema migration failed, usually because a database is missing or credentials changed.",
    "Read docker compose logs cloud-agent for the Flyway/JDBC error, confirm all four databases exist with docker compose exec postgres psql -U postgres -l, then reset with docker compose down -v.",
  ],
  [
    "Databases missing even though init.sql is present",
    "Scripts in /docker-entrypoint-initdb.d only run when the data directory is empty, and the pgdata volume already existed.",
    "docker compose down -v to drop the volume, then bring the stack back up so the init script runs.",
  ],
  [
    "no matching manifest for linux/arm64",
    "The pinned image has no arm64 build (common on Apple Silicon).",
    "Add platform: linux/amd64 to that service and expect emulation to be slower, or pick a tag that publishes multi-arch images.",
  ],
  [
    "pull access denied / unauthorized",
    "The tag points at a private or non-existent registry path.",
    "Use the public Docker Hub images identus/identus-cloud-agent and identus/prism-node with an explicit version tag — never :latest.",
  ],
  [
    "Agent healthy but the console cannot reach it",
    "The base URL is missing the /cloud-agent prefix, or the apikey header is not being sent.",
    "Use http://localhost:8085/cloud-agent and set the admin key to your ADMIN_TOKEN value, then re-run the health probe.",
  ],
];


function Docs() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link to="/" className="font-display min-w-0 truncate text-base sm:text-lg font-semibold tracking-tight">
            Identus<span className="text-primary">.</span>Companion
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/learn">Learn</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app">Open console</Link>
            </Button>
          </nav>
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
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Use <code className="font-mono text-xs text-foreground">postgres:13-alpine</code> with
            Cloud Agent 1.40. On Postgres 16 or newer the agent's{" "}
            <code className="font-mono text-xs text-foreground">V27</code> migration fails with{" "}
            <em>syntax error at or near “format”</em> and the agent never starts — both the Fly
            deploy and the Compose Lab template pin 13 for that reason.
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
            admin key injected as environment variables. The same box also powers the{" "}
            <strong className="text-foreground">Compose Lab</strong>, which authors, interpolates and
            lints the docker-local stack — ports, credentials, image tags and databases — and then
            hands you the bundle plus the commands to run it on your own machine. Sprites never
            executes the containers.
          </div>

        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Run Identus with Docker
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Docker Compose gives you the highest-fidelity local stack: the same images the hosted
            deployment uses, on your own machine, with logs and a debugger within reach.
          </p>

          <div className="mt-8 space-y-8 text-sm text-muted-foreground">
            <div>
              <h3 className="font-mono text-sm text-foreground">1 · Prerequisites</h3>
              <p className="mt-2">
                Docker Desktop or Docker Engine with the Compose v2 plugin — Compose is a{" "}
                <code className="font-mono text-xs text-foreground">docker compose</code> subcommand
                now, not the old <code className="font-mono text-xs">docker-compose</code> binary.
                The Cloud Agent and PRISM node are JVM services, so give Docker at least 4 GB of
                memory and 2 CPUs.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`docker compose version   # expect v2.x
docker info | grep -i "total memory"`}
              </pre>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">2 · Get a stack</h3>
              <p className="mt-2">
                Either take the upstream stack from the Cloud Agent repository, or generate a
                validated bundle from the Compose Lab in the console&apos;s Sandbox — it writes{" "}
                <code className="font-mono text-xs text-foreground">docker-compose.yml</code>,{" "}
                <code className="font-mono text-xs text-foreground">.env</code> and{" "}
                <code className="font-mono text-xs text-foreground">postgres/init.sql</code> with
                pinned image tags.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`git clone https://github.com/hyperledger-identus/cloud-agent
cd cloud-agent/infrastructure/local
./run.sh            # agent on http://localhost:8085/cloud-agent`}
              </pre>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">3 · Lifecycle commands</h3>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`docker compose config               # print the interpolated stack, catch .env typos
docker compose up -d --wait         # start and block until services are healthy
docker compose ps                   # state + published ports
docker compose logs -f cloud-agent  # follow one service
docker compose restart cloud-agent  # bounce a single service
docker compose pull && docker compose up -d   # upgrade to newer image tags
docker compose down                 # stop, keep the Postgres volume
docker compose down -v              # stop and DELETE all wallet + DID data`}
              </pre>
              <p className="mt-2">
                <code className="font-mono text-xs text-foreground">--wait</code> is the important
                one: it returns only once every service with a healthcheck reports healthy, so
                scripts never race a half-booted agent.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">4 · How the stack fits together</h3>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`  your app / console
          |  REST  :8085/cloud-agent          DIDComm  :8090
          v
   +--------------+  gRPC :50053   +------------+
   | cloud-agent  |--------------->| prism-node |
   +--------------+                +------------+
          |  pollux, connect, agent      |  node
          v                              v
              +--------------------------+
              |  postgres :5432 (pgdata) |
              +--------------------------+`}
              </pre>
              <p className="mt-2">
                Four databases are created by{" "}
                <code className="font-mono text-xs text-foreground">postgres/init.sql</code> —{" "}
                <code className="font-mono text-xs">pollux</code> (credentials),{" "}
                <code className="font-mono text-xs">connect</code> (DIDComm connections),{" "}
                <code className="font-mono text-xs">agent</code> (wallets and secrets) and{" "}
                <code className="font-mono text-xs">node</code> (PRISM node). Keeping them separate
                stops the modules&apos; migrations from colliding.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">5 · Environment and ports</h3>
              <div className="mt-3 overflow-hidden rounded-md border border-border/60">
                <div className="grid grid-cols-[1fr_auto_2fr] gap-px bg-border/60 text-xs">
                  <div className="bg-secondary/40 px-3 py-2 font-medium text-foreground">.env var</div>
                  <div className="bg-secondary/40 px-3 py-2 font-medium text-foreground">Default</div>
                  <div className="bg-secondary/40 px-3 py-2 font-medium text-foreground">Purpose</div>
                  {dockerEnv.map(([key, value, purpose]) => (
                    <div key={key} className="col-span-3 grid grid-cols-[1fr_auto_2fr] gap-px bg-border/60">
                      <div className="bg-card/60 px-3 py-2 font-mono text-foreground">{key}</div>
                      <div className="bg-card/60 px-3 py-2 font-mono">{value}</div>
                      <div className="bg-card/60 px-3 py-2">{purpose}</div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2">
                Only the left side of a port mapping is yours to change. If{" "}
                <code className="font-mono text-xs">5432</code> is already taken by a local
                Postgres, set <code className="font-mono text-xs text-foreground">POSTGRES_PORT=5433</code>{" "}
                — the container keeps listening on 5432 inside the network, so no other service
                needs editing.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">6 · Startup order and health</h3>
              <p className="mt-2">
                The agent cannot migrate its schema until Postgres accepts connections, so Postgres
                declares a <code className="font-mono text-xs">pg_isready</code> healthcheck and the
                other services depend on it with{" "}
                <code className="font-mono text-xs text-foreground">condition: service_healthy</code>.
                Plain <code className="font-mono text-xs">depends_on</code> only waits for the
                container to <em>start</em>, which is not the same as ready. The agent has its own
                healthcheck against{" "}
                <code className="font-mono text-xs">/_system/health</code> with a generous{" "}
                <code className="font-mono text-xs">start_period</code> for JVM boot.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">7 · Connect the console</h3>
              <p className="mt-2">
                On the Agents page pick <strong className="text-foreground">Docker local</strong>,
                set the base URL to{" "}
                <code className="font-mono text-xs text-foreground">http://localhost:8085/cloud-agent</code>{" "}
                and paste your <code className="font-mono text-xs">ADMIN_TOKEN</code> as the admin
                API key, then run the health probe. Verify from the shell first:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`curl -fsS http://localhost:8085/cloud-agent/_system/health
curl -fsS -H "apikey: $ADMIN_TOKEN" \\
  http://localhost:8085/cloud-agent/did-registrar/dids`}
              </pre>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">8 · Troubleshooting</h3>
              <div className="mt-3 space-y-3">
                {dockerTroubleshooting.map(([symptom, cause, fix]) => (
                  <div key={symptom} className="rounded-md border border-border/60 bg-card/60 p-3">
                    <p className="font-mono text-xs text-foreground">{symptom}</p>
                    <p className="mt-1 text-xs">
                      <span className="text-foreground">Cause:</span> {cause}
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="text-foreground">Fix:</span> {fix}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-mono text-sm text-foreground">9 · Data and cleanup</h3>
              <p className="mt-2">
                All state lives in the named volume{" "}
                <code className="font-mono text-xs text-foreground">pgdata</code>. Published DIDs and
                issued credentials do not survive a{" "}
                <code className="font-mono text-xs">down -v</code>, so back it up before resetting.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-4 font-mono text-xs">
{`docker compose exec postgres pg_dumpall -U postgres > identus-backup.sql
docker volume ls | grep pgdata
docker compose down -v && docker compose up -d --wait   # clean slate`}
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Other ways to run</h2>
          <div className="mt-6 space-y-6 text-sm text-muted-foreground">
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
