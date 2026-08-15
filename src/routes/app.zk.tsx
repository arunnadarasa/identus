import { createFileRoute, Link } from "@tanstack/react-router";
import { EyeOff, Info, ArrowLeft } from "lucide-react";
import { ZkProofLive } from "@/components/zk/ZkProofLive";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/zk")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Zero-knowledge proof — Identus Companion" },
      {
        name: "description",
        content:
          "Compile a Noir circuit in your browser and generate an UltraHonk zero-knowledge proof that you are over 18, without revealing your birth year.",
      },
      {
        property: "og:title",
        content: "Zero-knowledge proof — Identus Companion",
      },
      {
        property: "og:description",
        content:
          "A real in-browser ZK proof: prove a fact about a credential without disclosing the data behind it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ZkPage,
});

function ZkPage() {
  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
          <EyeOff className="mr-1.5 h-3.5 w-3.5" />
          Zero-knowledge
        </Badge>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Prove it without showing it
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Enter a birth year, then generate a proof that it clears the age
          threshold. The circuit is compiled here, the proof is produced by
          Barretenberg's UltraHonk prover, and the verifier only ever sees the
          public threshold — never the year itself.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Everything runs in your browser as WebAssembly — no agent, no server
          round-trip, no key material leaving the page. That means this works in
          every agent mode, including simulated. Identus credential
          presentations are a separate layer: the console issues JWT-based
          credentials, which do selective disclosure rather than zero-knowledge
          proofs. AnonCreds and BBS+ are the ZK-capable formats that would bind
          a proof like this one to an issued credential.
        </p>
      </div>

      <ZkProofLive />

      <p className="text-sm text-muted-foreground">
        New to the idea?{" "}
        <Link
          to="/learn"
          hash="zk"
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Read the plain-English explainer
        </Link>
      </p>
    </div>
  );
}
