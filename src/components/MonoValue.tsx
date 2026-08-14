import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shorten a long machine identifier for display: did:prism:4e30…81b5 */
export function shortenId(value: string, head = 4, tail = 4): string {
  if (!value) return "";
  const parts = value.split(":");
  const last = parts[parts.length - 1] ?? value;
  if (last.length <= head + tail + 1) return value;
  const short = `${last.slice(0, head)}…${last.slice(-tail)}`;
  return parts.length > 1 ? `${parts.slice(0, -1).join(":")}:${short}` : short;
}

type TruncatedMonoProps = {
  value: string;
  label?: string;
  className?: string;
  /** Show a copy button (default true) */
  copy?: boolean;
};

/**
 * Long machine-generated strings (JWTs, invitation URLs) rendered as a
 * collapsed two-line preview with expand + copy actions, so they never
 * dominate or overflow a narrow screen.
 */
export function TruncatedMono({ value, label, className, copy = true }: TruncatedMonoProps) {
  const [open, setOpen] = useState(false);
  if (!value) return null;

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate text-xs text-muted-foreground">{label ?? ""}</p>
        {copy ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 shrink-0 px-3 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
        ) : null}
      </div>
      <p
        className={cn(
          "w-full min-w-0 overflow-hidden break-all rounded-md bg-secondary/40 p-2 font-mono text-[11px] text-muted-foreground",
          !open && "line-clamp-2",
        )}
      >
        {value}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show full"}
        </Button>
      </div>
    </div>
  );
}
