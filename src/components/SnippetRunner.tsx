import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Play, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  getSandbox,
  runSnippet,
  saveSnippet,
  deleteSnippet,
  resetStarterSnippets,
} from "@/lib/sprites/sandbox.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Sandbox = Awaited<ReturnType<typeof getSandbox>>;
type Snippet = Sandbox["snippets"][number];

export type SnippetDraft = { name: string; code: string; token: number };

export function SnippetRunner({ data, draft }: { data: Sandbox; draft?: SnippetDraft | null }) {
  const qc = useQueryClient();
  const doRun = useServerFn(runSnippet);
  const doSave = useServerFn(saveSnippet);
  const doDelete = useServerFn(deleteSnippet);
  const doReset = useServerFn(resetStarterSnippets);
  const [resetting, setResetting] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(data.snippets[0]?.id ?? null);
  const [name, setName] = useState(data.snippets[0]?.name ?? "Untitled snippet");
  const [code, setCode] = useState(data.snippets[0]?.code ?? "");
  const [output, setOutput] = useState(data.snippets[0]?.lastOutput ?? "");
  const [exitCode, setExitCode] = useState<number | null>(
    data.snippets[0]?.lastExitCode ?? null,
  );
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => data.snippets.find((s) => s.id === selectedId) ?? null,
    [data.snippets, selectedId],
  );

  // Follow the server list when a different snippet is picked.
  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setCode(selected.code);
    setOutput(selected.lastOutput ?? "");
    setExitCode(selected.lastExitCode ?? null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // An incoming draft (e.g. from the quickstart panel) becomes a new unsaved
  // snippet in the editor. The token makes repeat loads of the same snippet fire.
  useEffect(() => {
    if (!draft) return;
    setSelectedId(null);
    setName(draft.name);
    setCode(draft.code);
    setOutput("");
    setExitCode(null);
  }, [draft?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sandbox"] });

  const pick = (snippet: Snippet) => setSelectedId(snippet.id);

  const newSnippet = () => {
    setSelectedId(null);
    setName("Untitled snippet");
    setCode('console.log("hello from the Identus sandbox");\n');
    setOutput("");
    setExitCode(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await doSave({ data: { ...(selectedId ? { id: selectedId } : {}), name, code } });
      setSelectedId(res.id);
      toast.success("Snippet saved");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the snippet");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setOutput("Running in your sandbox…");
    try {
      const res = await doRun({
        data: { ...(selectedId ? { id: selectedId } : {}), name, code },
      });
      if (res.snippetId) setSelectedId(res.snippetId);
      setOutput(res.output || "(no output)");
      setExitCode(res.exitCode ?? null);
      if (res.message) toast.warning(res.message);
      invalidate();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
      setExitCode(null);
    } finally {
      setRunning(false);
    }
  };

  const resetStarters = async () => {
    setResetting(true);
    try {
      const res = await doReset({});
      invalidate();
      toast.success(
        `Starter snippets refreshed — ${res.updated} updated, ${res.inserted} added`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the starters");
    } finally {
      setResetting(false);
    }
  };

  const remove = async (id: string) => {
    await doDelete({ data: { id } });
    if (id === selectedId) newSnippet();
    invalidate();
    toast.success("Snippet deleted");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-display text-base">Snippets</CardTitle>
            <Button variant="outline" size="sm" onClick={newSnippet}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New
            </Button>
          </div>
          <CardDescription>Saved per account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 px-2 pb-3">
          {data.snippets.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No snippets yet — create the sandbox to seed starters.
            </p>
          ) : null}
          {data.snippets.map((snippet) => (
            <div
              key={snippet.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 transition-colors",
                snippet.id === selectedId ? "bg-secondary" : "hover:bg-secondary/50",
              )}
            >
              <button
                type="button"
                onClick={() => pick(snippet)}
                className="min-w-0 flex-1 truncate py-2.5 text-left text-sm"
              >
                {snippet.name}
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${snippet.name}`}
                className="h-7 w-7 shrink-0 text-muted-foreground opacity-70"
                onClick={() => remove(snippet.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Editor</CardTitle>
            <CardDescription>
              ES modules with top-level await. <code>AGENT_BASE_URL</code> and{" "}
              <code>AGENT_API_KEY</code> are injected from your active agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snippet-name">Name</Label>
              <Input
                id="snippet-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Create a Peer DID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snippet-code">Code</Label>
              <Textarea
                id="snippet-code"
                value={code}
                spellCheck={false}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-[18rem] font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={run} disabled={running || !data.box} className="sm:w-auto">
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run in sandbox
              </Button>
              <Button variant="outline" onClick={save} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="font-display text-base">Output</CardTitle>
            {exitCode === null ? null : (
              <Badge variant={exitCode === 0 ? "secondary" : "destructive"}>
                exit {exitCode}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-foreground/85">
              {output || "Run a snippet to see stdout and stderr here."}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
