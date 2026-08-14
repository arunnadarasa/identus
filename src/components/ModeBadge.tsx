import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { MODE_LABELS, type AgentMode } from "@/lib/identus/types";

const MODE_STYLES: Record<AgentMode, string> = {
  simulated: "border-border bg-secondary text-muted-foreground",
  docker: "border-accent/50 bg-accent/15 text-accent-foreground",
  fly: "border-primary/50 bg-primary/15 text-primary",
};

function dotClass(health?: string | null) {
  if (health === "healthy") return "bg-primary";
  if (health === "unhealthy" || health === "error") return "bg-destructive";
  return "bg-muted-foreground";
}

/** Pill showing which agent mode the console is currently using. */
export function ModeBadge({
  mode,
  name,
  health,
  compact = false,
  className,
}: {
  mode?: AgentMode | null;
  name?: string | null;
  health?: string | null;
  compact?: boolean;
  className?: string;
}) {
  if (!mode) {
    return (
      <Link
        to="/app/agents"
        aria-label="No agent selected — open Agents"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        No agent
      </Link>
    );
  }

  const label = MODE_LABELS[mode];
  const suffix = !compact && mode === "fly" && name ? ` · ${name}` : "";

  return (
    <Link
      to="/app/agents"
      title={`${label}${name ? ` · ${name}` : ""} · ${health ?? "unknown"}`}
      aria-label={`Active agent mode: ${label}. Open Agents`}
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
        MODE_STYLES[mode],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass(health))} />
      <span className="truncate">
        {label}
        {suffix}
      </span>
    </Link>
  );
}
