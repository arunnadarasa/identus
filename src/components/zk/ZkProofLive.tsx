import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

/**
 * The Noir + Barretenberg proving stack is browser-only WebAssembly, so it must
 * stay off the SSR graph entirely: ClientOnly gates rendering, lazy() gates the
 * import so the wasm payload is only fetched in the browser.
 */
const LazyZk = lazy(() => import("./zk-proof-client-entry"));

function Placeholder({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

export function ZkProofLive() {
  return (
    <ClientOnly fallback={<Placeholder note="Loading the live proof demo…" />}>
      <Suspense fallback={<Placeholder note="Loading the live proof demo…" />}>
        <LazyZk />
      </Suspense>
    </ClientOnly>
  );
}
