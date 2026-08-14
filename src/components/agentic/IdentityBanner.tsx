import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TruncatedMono } from "@/components/MonoValue";

export type AgenticIdentityView = {
  mode: "simulated" | "docker" | "fly" | null;
  simulated: boolean;
  reason: string;
  buyerDid: string;
  sellerDid: string;
  buyerLabel: string;
  sellerLabel: string;
  credentialType: string;
};

/**
 * Says plainly which identities the demo is using and whether the credential
 * is a real one issued by the user's agent or a demo stand-in.
 */
export function IdentityBanner({ identity }: { identity: AgenticIdentityView | undefined }) {
  if (!identity) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">Identity context</span>
        <Badge variant="outline" className="text-[10px]">
          {identity.mode ? `${identity.mode} agent` : "no agent"}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] ${identity.simulated ? "text-amber-400 border-amber-500/40" : "text-emerald-400 border-emerald-500/40"}`}
        >
          {identity.simulated ? "demo credential" : "agent-issued credential"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {identity.reason}{" "}
        <Link to="/app/agents" className="text-primary underline-offset-2 hover:underline">
          Manage agents
        </Link>
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{identity.buyerLabel} (buyer)</dt>
          <dd>
            <TruncatedMono value={identity.buyerDid} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{identity.sellerLabel} (seller)</dt>
          <dd>
            <TruncatedMono value={identity.sellerDid} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
