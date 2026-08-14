import { useState } from "react";
import { ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Collapsible, horizontally scrollable JSON viewer for protocol envelopes. */
export function JsonBlock({
  value,
  label = "Raw envelope",
  defaultOpen = false,
}: {
  value: unknown;
  label?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (value === undefined || value === null) return null;
  const text = JSON.stringify(value, null, 2);

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-muted/30">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="truncate">{label}</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-1.5 text-xs"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success("Copied JSON");
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {open ? (
        <pre className="max-h-72 overflow-auto border-t border-border/60 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {text}
        </pre>
      ) : null}
    </div>
  );
}
