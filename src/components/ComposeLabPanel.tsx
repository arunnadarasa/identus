import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  Loader2,
  Play,
  PlugZap,
  RotateCcw,
  Save,
  Wrench,
} from "lucide-react";
import {
  getComposeLab,
  ensureComposeLab,
  saveComposeFile,
  validateCompose,
  adoptComposeAgent,
} from "@/lib/sprites/compose.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProvisionStep } from "@/lib/identus/types";

const FILE_ORDER = ["docker-compose.yml", ".env", "postgres/init.sql"] as const;
type FileName = (typeof FILE_ORDER)[number];

function StepList({ steps }: { steps: ProvisionStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ul className="max-h-56 overflow-auto rounded-md border border-border/60 bg-muted/30">
      {steps.map((step, index) => (
        <li
          key={`${step.step}-${index}`}
          className="flex items-start gap-2 border-b border-border/40 px-3 py-2 font-mono text-[11px] last:border-0"
        >
          {step.status === "running" ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : step.status === "error" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <div className={step.status === "error" ? "text-destructive" : ""}>{step.step}</div>
            {step.detail ? (
              <div className="break-words text-muted-foreground">{step.detail}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ComposeLabPanel() {
  const qc = useQueryClient();
  const fetchLab = useServerFn(getComposeLab);
  const provision = useServerFn(ensureComposeLab);
  const save = useServerFn(saveComposeFile);
  const validate = useServerFn(validateCompose);
  const adopt = useServerFn(adoptComposeAgent);

  const { data, isLoading } = useQuery({
    queryKey: ["compose-lab"],
    queryFn: () => fetchLab(),
  });

  const [busy, setBusy] = useState<
    "create" | "reset" | "validate" | "save" | "adopt" | null
  >(null);
  const [liveSteps, setLiveSteps] = useState<ProvisionStep[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    errors: string[];
    warnings: string[];
    resolved: string;
  } | null>(null);
  const [active, setActive] = useState<FileName>("docker-compose.yml");

  // Seed the editors once the saved bundle arrives.
  useEffect(() => {
    if (!data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const file of data.files) {
        if (next[file.name] === undefined) next[file.name] = file.content;
      }
      return next;
    });
    if (!result && data.files[0]?.lastResult) {
      setResult(data.files.find((f) => f.name === "docker-compose.yml")?.lastResult ?? null);
    }
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["compose-lab"] });

  const files = useMemo(() => {
    const map = new Map(data?.files.map((f) => [f.name, f.content]) ?? []);
    return FILE_ORDER.map((name) => ({
      name,
      content: drafts[name] ?? map.get(name) ?? "",
      saved: map.get(name) ?? "",
    }));
  }, [data, drafts]);

  const dirty = files.some((f) => f.content !== f.saved);

  const create = async (reset: boolean) => {
    setBusy(reset ? "reset" : "create");
    setLiveSteps([]);
    try {
      const res = await provision({ data: { reset } });
      setLiveSteps(res.steps as ProvisionStep[]);
      if (res.ok) {
        toast.success(reset ? "Bundle reset to defaults" : "Compose lab ready");
        if (reset) setDrafts({});
      } else {
        toast.error(res.message || "Could not set up the compose lab");
      }
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setBusy(null);
    }
  };

  const saveAll = async () => {
    setBusy("save");
    try {
      for (const file of files) {
        if (file.content !== file.saved) {
          await save({ data: { name: file.name, content: file.content } });
        }
      }
      toast.success("Bundle saved");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const runValidate = async () => {
    setBusy("validate");
    try {
      for (const file of files) {
        if (file.content !== file.saved) {
          await save({ data: { name: file.name, content: file.content } });
        }
      }
      const res = await validate({});
      if (res.report) {
        setResult(res.report);
        if (res.ok) {
          toast.success(
            res.report.warnings.length
              ? `Valid with ${res.report.warnings.length} warning(s)`
              : "Compose bundle is valid",
          );
        } else {
          toast.error(`${res.report.errors.length} error(s) found`);
        }
      } else {
        toast.error(res.message || "Validation failed");
      }
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setBusy(null);
    }
  };

  const copyCommands = async () => {
    await navigator.clipboard.writeText(data?.runCommands ?? "");
    toast.success("Run commands copied");
  };

  const download = () => {
    for (const file of files) {
      const blob = new Blob([file.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace("/", "-");
      link.click();
      URL.revokeObjectURL(url);
    }
    toast.success("Bundle downloaded");
  };

  const useAsAgent = async () => {
    setBusy("adopt");
    try {
      const res = await adopt({});
      toast.success(
        res.created
          ? `Added docker-local agent at ${res.baseUrl}`
          : `Updated docker-local agent at ${res.baseUrl}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the agent");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading the compose lab…</p>;
  }

  const steps = liveSteps.length ? liveSteps : data.labSteps;

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">
            Containers do not run inside the sandbox
          </CardTitle>
          <CardDescription>
            Sprites.dev gives you a fast Linux micro-environment with no Docker daemon. The lab
            authors, interpolates and lints your Identus stack in seconds, then hands you a bundle
            and the exact commands to run it on your own machine.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Compose lab</CardTitle>
            {data.labReady ? <Badge variant="secondary">toolkit installed</Badge> : null}
          </div>
          <CardDescription className="break-all font-mono text-xs">
            {data.spriteName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={() => create(false)} disabled={busy !== null || !data.hasToken}>
              {busy === "create" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {data.labReady ? "Repair lab" : "Create compose lab"}
            </Button>
            <Button variant="outline" onClick={runValidate} disabled={busy !== null || !data.labReady}>
              {busy === "validate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Validate &amp; render
            </Button>
            <Button variant="outline" onClick={() => create(true)} disabled={busy !== null}>
              {busy === "reset" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reset defaults
            </Button>
          </div>
          {!data.hasToken ? (
            <p className="text-sm text-destructive">
              Add a Sprites token to create the lab.
            </p>
          ) : null}
          <StepList steps={steps} />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Bundle</CardTitle>
            {dirty ? <Badge variant="outline">unsaved changes</Badge> : null}
          </div>
          <CardDescription>
            Edit the stack, then validate. Ports, credentials and databases are checked together.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={active} onValueChange={(v) => setActive(v as FileName)}>
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              {FILE_ORDER.map((name) => (
                <TabsTrigger key={name} value={name} className="text-xs">
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
            {files.map((file) => (
              <TabsContent key={file.name} value={file.name} className="pt-4">
                <Textarea
                  value={file.content}
                  spellCheck={false}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [file.name]: e.target.value }))
                  }
                  className="min-h-[320px] font-mono text-xs"
                  aria-label={file.name}
                />
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" onClick={saveAll} disabled={busy !== null || !dirty}>
              {busy === "save" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
            <Button variant="outline" onClick={copyCommands} disabled={busy !== null}>
              <Copy className="mr-2 h-4 w-4" />
              Copy run commands
            </Button>
            <Button variant="outline" onClick={download} disabled={busy !== null}>
              <Download className="mr-2 h-4 w-4" />
              Download bundle
            </Button>
            <Button variant="outline" onClick={useAsAgent} disabled={busy !== null}>
              {busy === "adopt" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="mr-2 h-4 w-4" />
              )}
              Add as docker-local agent
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-base">Validation</CardTitle>
              <Badge
                variant="outline"
                className={
                  result.errors.length
                    ? "border-destructive/50 text-destructive"
                    : "border-primary/40 text-primary"
                }
              >
                {result.errors.length ? `${result.errors.length} error(s)` : "valid"}
              </Badge>
              {result.warnings.length ? (
                <Badge variant="outline">{result.warnings.length} warning(s)</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.errors.length ? (
              <ul className="space-y-1 text-sm text-destructive">
                {result.errors.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{issue}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {result.warnings.length ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.warnings.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{issue}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {result.resolved ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Resolved config (env vars interpolated)
                </p>
                <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                  {result.resolved}
                </pre>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Run it locally</p>
              <pre className="overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                {data.runCommands}
              </pre>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
