import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single heading treatment for every marketing section: a small uppercase
 * eyebrow, a display-font title and an optional lead paragraph. Defining it once
 * keeps `/`, `/learn`, `/nhs` and `/docs` reading as one product.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-rise",
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        className,
      )}
    >
      {eyebrow ? (
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 text-base text-muted-foreground">{lead}</p> : null}
    </div>
  );
}
