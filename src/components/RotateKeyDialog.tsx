import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { rotateFlyAdminKey } from "@/lib/identus/fly.functions";
import { setConnectionKey } from "@/lib/identus.functions";
import { ProvisionLogViewer } from "@/components/ProvisionLogViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  connection: any;
  onChanged?: (() => void) | undefined;
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
}

/**
 * Rotates the admin API key of a deployed Fly agent (machine env + stored key),
 * or lets a docker-local agent's stored key be replaced by hand.
 */
export function RotateKeyDialog({ connection, onChanged, size = "sm", variant = "outline" }: Props) {
  const rotate = useServerFn(rotateFlyAdminKey);
  const setKey = useServerFn(setConnectionKey);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState("");
  const [running, setRunning] = useState(false);

  if (connection.mode === "simulated") return null;
  const isFly = connection.mode === "fly";

  const reset = () => {
    setNewKey(null);
    setFailure(null);
    setManualKey("");
    setRunning(false);
  };

  const runRotate = async () => {
    setBusy(true);
    setRunning(true);
    setFailure(null);
    try {
      const result = await rotate({ data: { id: connection.id } });
      onChanged?.();
      if (result.ok && result.apiKey) {
        setNewKey(result.apiKey);
        toast.success("Admin credentials rotated");
      } else {
        setFailure(result.message);
        toast.error(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFailure(message);
      toast.error(message);
    } finally {
      setBusy(false);
      setRunning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
          Rotate admin credentials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Rotate admin credentials</DialogTitle>
          <DialogDescription>
            {isFly
              ? `A new admin API key is written into the ${connection.fly_app_name} machine configuration. The agent restarts and is verified with the new key before the console switches over.`
              : "The admin key of a Docker-local agent is set in your compose file. Paste the current value here to keep the console in sync."}
          </DialogDescription>
        </DialogHeader>

        {isFly ? (
          <div className="space-y-4">
            {newKey ? (
              <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  New admin API key — stored in your console configuration and shown once here.
                </p>
                <p className="break-all font-mono text-xs">{newKey}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newKey);
                    toast.success("Admin key copied");
                  }}
                >
                  Copy key
                </Button>
              </div>
            ) : null}

            {failure ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {failure}
              </p>
            ) : null}

            {running || newKey || failure ? (
              <ProvisionLogViewer
                connectionId={connection.id}
                live={running}
                showMachines={false}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                The agent is briefly unavailable while the machine restarts. If it does not accept
                the new key, the previous credentials are restored automatically.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                {newKey ? "Done" : "Cancel"}
              </Button>
              <Button onClick={runRotate} disabled={busy}>
                {busy ? "Rotating…" : newKey ? "Rotate again" : "Rotate key"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-key">Admin API key</Label>
              <Input
                id="manual-key"
                type="password"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="value of ADMIN_TOKEN in your compose file"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                disabled={busy || !manualKey.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await setKey({
                      data: { id: connection.id, apiKey: manualKey.trim() },
                    });
                    onChanged?.();
                    result.healthy
                      ? toast.success(result.message)
                      : toast.warning(result.message);
                    setOpen(false);
                    reset();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : String(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save key"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
