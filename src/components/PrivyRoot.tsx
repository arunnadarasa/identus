import { lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";

/** lazy + ClientOnly keeps Privy entirely off the SSR graph. */
const LazyPrivy = lazy(() => import("./privy-client-entry"));

export function PrivyRoot({ appId, children }: { appId: string; children: ReactNode }) {
  if (!appId) return <>{children}</>;
  return (
    <ClientOnly fallback={<>{children}</>}>
      <Suspense fallback={<>{children}</>}>
        <LazyPrivy appId={appId}>{children}</LazyPrivy>
      </Suspense>
    </ClientOnly>
  );
}
