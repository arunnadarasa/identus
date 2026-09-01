import { useState } from "react";
import { CloudOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Flip to false once the backend is resumed — the banner disappears everywhere.
 */
export const CLOUD_PAUSED = true;

const OFFLINE = [
  "Sign in / sign up",
  "Agents, DIDs & credentials",
  "Agentic demos (A2A, AP2, UCP, x402)",
  "SDK sandbox & activity log",
] as const;

/**
 * App-wide notice explaining that the hosted backend is paused and which
 * features are therefore unavailable. Static pages (home, learn, NHS, docs)
 * keep working.
 */
export function CloudStatusBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (!CLOUD_PAUSED || dismissed) return null;

  return (
    <div
      role="status"
      className="relative z-30 border-b border-warning/40 bg-warning/10 px-4 py-3 text-warning sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Backend paused — some features are offline</p>
          <p className="mt-1 text-warning/80">
            Currently unavailable: {OFFLINE.join(" · ")}. Reading the guides, NHS
            walkthrough and docs still works.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss notice"
          className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-warning hover:bg-warning/15 hover:text-warning"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
