import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The shared elevated surface for marketing feature cards: frosted card, a soft
 * indigo wash behind the icon, hover lift, and an optional call to action.
 * Colours come from semantic tokens so the console theme stays in sync.
 */
export function PremiumCard({
  icon: Icon,
  eyebrow,
  title,
  children,
  to,
  cta,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  /** Typed router paths only; omit for a non-linking card. */
  to?: "/learn" | "/nhs" | "/docs" | "/auth" | "/app" | "/app/zk" | "/app/demos" | "/app/sandbox";
  cta?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass hover-lift group relative flex h-full flex-col overflow-hidden rounded-xl p-5 shadow-elegant",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-60"
      />
      <div className="relative flex items-center gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : null}
        {eyebrow ? (
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
      </div>
      <h3 className="relative mt-4 text-lg font-semibold">{title}</h3>
      <div className="relative mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
      {to && cta ? (
        <Link
          to={to}
          className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  );
}
