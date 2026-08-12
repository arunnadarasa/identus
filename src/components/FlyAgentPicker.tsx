import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  flyOrganizations,
  flyApps,
  adoptFlyAgent,
  destroyFlyAppByName,
} from "@/lib/identus/fly.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Lists the Fly apps in an organisation and lets one become the console's
 * active agent in a single click — the URL and admin key are written to the
 * connection record server-side.
 */
export function FlyAgentPicker({ onChanged }: { onChanged?: () => void }) {
  const orgsFn = useServerFn(flyOrganizations);
  const appsFn = useServerFn(flyApps);
  const adopt = useServerFn(adoptFlyAgent);

  const [org, setOrg] = useState<string>("");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: orgs } = useQuery({
    queryKey: ["fly", "orgs"],
    queryFn: () => orgsFn(),
  });

  const orgList = orgs?.orgs ?? [];
  const selectedOrg = org || orgList[0]?.slug || "";

  const {
    data: apps,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["fly", "apps", selectedOrg],
    queryFn: () => appsFn({ data: { orgSlug: selectedOrg } }),
    enabled: Boolean(selectedOrg),
  });

  const use = async (app: {
    name: string;
    hasKey: boolean;
    machines: { region: string }[];
  }) => {
    const typed = keys[app.name]?.trim();
    if (!app.hasKey && !typed) {
      toast.error("Paste the agent's admin API key first");
      return;
    }
    setBusy(app.name);
    try {
      const result = await adopt({
        data: {
          appName: app.name,
          ...(app.machines[0]?.region ? { region: app.machines[0].region } : {}),
          ...(typed ? { adminKey: typed } : {}),
        },
      });
      onChanged?.();
      refetch();
      result.healthy
        ? toast.success(`${app.name} is now the active agent`)
        : toast.warning(`Saved ${app.name} as active agent — ${result.message}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="fly-picker-org">Fly organisation</Label>
          <Select value={selectedOrg} onValueChange={setOrg}>
            <SelectTrigger id="fly-picker-org">
              <SelectValue placeholder={orgs?.ok ? "Select an organisation" : "Unavailable"} />
            </SelectTrigger>
            <SelectContent>
              {orgList.map((o) => (
                <SelectItem key={o.slug} value={o.slug}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!selectedOrg}>
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {orgs && !orgs.ok ? (
        <p className="text-sm text-destructive">{orgs.message}</p>
      ) : null}
      {apps && !apps.ok ? <p className="text-sm text-destructive">{apps.message}</p> : null}

      <div className="space-y-3">
        {(apps?.apps ?? []).map((app) => (
          <div
            key={app.name}
            className="rounded-md border border-border/60 bg-secondary/30 p-3 sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-sm">{app.name}</span>
                  {app.isActive ? <Badge className="text-xs">active</Badge> : null}
                  {app.connectionId && !app.isActive ? (
                    <Badge variant="outline" className="text-xs">
                      tracked
                    </Badge>
                  ) : null}
                </div>
                <p className="break-all pt-1 font-mono text-xs text-muted-foreground">
                  https://{app.name}.fly.dev
                </p>
                <p className="pt-1 text-xs text-muted-foreground">
                  {app.status} ·{" "}
                  {app.machines.length
                    ? app.machines.map((m) => `${m.name}: ${m.state}`).join(" · ")
                    : `${app.machineCount} machines`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy === app.name || app.isActive}
                  onClick={() => use(app)}
                >
                  {app.isActive
                    ? "In use"
                    : busy === app.name
                      ? "Saving…"
                      : "Use this agent"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy === app.name}
                  onClick={async () => {
                    if (!confirm(`Destroy Fly app ${app.name}? This is permanent.`)) return;
                    setBusy(app.name);
                    try {
                      await destroyByName({
                        data: { appName: app.name, orgSlug: selectedOrg },
                      });
                      onChanged?.();
                      refetch();
                      toast.success(`${app.name} destroyed`);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : String(error));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Destroy
                </Button>
              </div>
            </div>

            {!app.hasKey ? (
              <div className="mt-3 space-y-2">
                <Label htmlFor={`key-${app.name}`} className="text-xs">
                  Admin API key for this app
                </Label>
                <Input
                  id={`key-${app.name}`}
                  type="password"
                  placeholder="paste once — stored securely"
                  value={keys[app.name] ?? ""}
                  onChange={(e) => setKeys((k) => ({ ...k, [app.name]: e.target.value }))}
                />
              </div>
            ) : null}
          </div>
        ))}
        {apps?.ok && apps.apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No apps in this organisation yet — deploy one below.
          </p>
        ) : null}
      </div>
    </div>
  );
}
