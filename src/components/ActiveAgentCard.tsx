import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { revealConnectionKey, testConnection } from "@/lib/identus.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateKeyDialog } from "@/components/RotateKeyDialog";
import { MODE_LABELS, type AgentMode } from "@/lib/identus/types";

/** Shows the console configuration currently in use: mode, URL, health, admin key. */
export function ActiveAgentCard({
  connection,
  onChecked,
}: {
  connection: any;
  onChecked?: () => void;
}) {
  const reveal = useServerFn(revealConnectionKey);
  const check = useServerFn(testConnection);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="font-display flex flex-wrap items-center gap-2 text-base">
            Console configuration
            <Badge className="text-xs">{connection.name}</Badge>
          </CardTitle>
          <CardDescription className="pt-1 text-xs">
            {MODE_LABELS[connection.mode as AgentMode]} · all protocol calls use this agent
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <RotateKeyDialog connection={connection} onChanged={onChecked} />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await check({ data: { id: connection.id } });
              onChecked?.();
              result.healthy ? toast.success(result.message) : toast.warning(result.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "Re-check"}
        </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <Row label="Base URL">
          <span className="break-all font-mono">{connection.base_url ?? "in-app runtime"}</span>
        </Row>
        <Row label="Health">
          <span className="font-mono">{connection.last_health ?? "untested"}</span>
        </Row>
        <Row label="Admin key">
          {connection.has_api_key ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all font-mono">{key ?? "••••••••••••••••"}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={async () => {
                  if (key) {
                    setKey(null);
                    return;
                  }
                  const result = await reveal({ data: { id: connection.id } });
                  if (!result.apiKey) {
                    toast.error("No admin key stored for this agent");
                    return;
                  }
                  setKey(result.apiKey);
                }}
              >
                {key ? "Hide" : "Reveal"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={async () => {
                  const value = key ?? (await reveal({ data: { id: connection.id } })).apiKey;
                  if (!value) {
                    toast.error("No admin key stored for this agent");
                    return;
                  }
                  await navigator.clipboard.writeText(value);
                  toast.success("Admin key copied");
                }}
              >
                Copy
              </Button>
            </span>
          ) : (
            <span className="text-muted-foreground">not required</span>
          )}
        </Row>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
