import { Bot, Store, ShieldCheck, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { JsonBlock } from "@/components/agentic/JsonBlock";
import { shortenId } from "@/components/MonoValue";

export type TranscriptStep = {
  step: number;
  label: string;
  actor: "buyer" | "seller" | "human" | "verifier";
  detail: string;
  /**
   * Long machine identifiers (addresses, hashes, DIDs) belong here rather than
   * inline in `detail` — they render as shortened mono rows so a 42-character
   * hex string can never push the card past a phone's width.
   */
  values?: { label: string; value: string }[];
  envelope?: unknown;
  state?: string;
  simulated?: boolean;
};


const actorMeta = {
  buyer: { icon: Bot, label: "Buyer agent", tone: "text-primary" },
  seller: { icon: Store, label: "Seller agent", tone: "text-amber-400" },
  verifier: { icon: ShieldCheck, label: "Verification", tone: "text-emerald-400" },
  human: { icon: User, label: "Human", tone: "text-muted-foreground" },
} as const;

const stateTone: Record<string, string> = {
  completed: "border-emerald-500/40 text-emerald-400",
  "input-required": "border-amber-500/40 text-amber-400",
  rejected: "border-destructive/40 text-destructive",
  failed: "border-destructive/40 text-destructive",
  working: "border-primary/40 text-primary",
  submitted: "border-border text-muted-foreground",
};

/** Vertical protocol transcript: one entry per real message on the wire. */
export function TranscriptView({ steps }: { steps: TranscriptStep[] }) {
  if (!steps.length) return null;
  return (
    <ol className="space-y-3">
      {steps.map((s) => {
        const meta = actorMeta[s.actor] ?? actorMeta.human;
        const Icon = meta.icon;
        return (
          <li
            key={`${s.step}-${s.label}`}
            className="relative rounded-lg border border-border/70 bg-card/60 p-3 pl-10 sm:p-4 sm:pl-12"
          >
            <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold sm:left-4 sm:top-4">
              {s.step}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
              <span className="text-sm font-semibold">{s.label}</span>
              {s.state ? (
                <Badge variant="outline" className={`text-[10px] ${stateTone[s.state] ?? ""}`}>
                  {s.state}
                </Badge>
              ) : null}
              {s.simulated ? (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  scripted
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.detail}</p>
            <JsonBlock value={s.envelope} />
          </li>
        );
      })}
    </ol>
  );
}
