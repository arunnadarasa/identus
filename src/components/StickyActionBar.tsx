import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Keeps a card's primary action reachable on phones: pinned to the bottom of
 * the viewport while the card is on screen, plain inline content from sm: up.
 */
export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-6 mt-2 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
