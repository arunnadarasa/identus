import { useState } from "react";
import { toast } from "sonner";
import { Check, Code2, Copy, FileInput } from "lucide-react";

import {
  DELEGATION_QUICKSTART,
  type QuickstartSnippet,
} from "@/lib/sprites/delegation-snippets";
import { DELEGATION_CREDENTIAL_TYPE } from "@/lib/agentic/x402-mandate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  /** Present when a sandbox box exists — enables "Load into editor". */
  onLoadIntoEditor?: ((snippet: { name: string; code: string }) => void) | undefined;
};

/**
 * Minimal, copyable code for the one flow people ask about first: mint a
 * delegation credential for an agent, then verify it before honouring the
 * delegated action. The snippets are plain ES modules so they paste straight
 * into the sandbox runner below.
 */
export function SdkQuickstartPanel({ onLoadIntoEditor }: Props) {
  const [active, setActive] = useState(DELEGATION_QUICKSTART[0]!.id);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (snippet: QuickstartSnippet) => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(snippet.id);
      window.setTimeout(() => setCopied((c) => (c === snippet.id ? null : c)), 1600);
      toast.success(`${snippet.label} copied`);
    } catch {
      toast.error("Your browser blocked clipboard access — select the code and copy manually.");
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <CardTitle className="font-display text-base">
            Quickstart — delegation credentials
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            TypeScript
          </Badge>
        </div>
        <CardDescription>
          The smallest working code for issuing a {DELEGATION_CREDENTIAL_TYPE} and verifying it
          before an agent acts. Signing uses WebCrypto ES256, so every snippet runs unchanged in the
          browser, in Node, and in the sandbox below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={active} onValueChange={setActive} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            {DELEGATION_QUICKSTART.map((snippet) => (
              <TabsTrigger key={snippet.id} value={snippet.id} className="text-xs sm:text-sm">
                {snippet.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {DELEGATION_QUICKSTART.map((snippet) => (
            <TabsContent key={snippet.id} value={snippet.id} className="space-y-3">
              <p className="text-sm text-muted-foreground">{snippet.description}</p>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(snippet)}>
                  {copied === snippet.id ? (
                    <Check className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {copied === snippet.id ? "Copied" : "Copy"}
                </Button>
                {onLoadIntoEditor && snippet.runnable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onLoadIntoEditor({ name: snippet.name, code: snippet.code });
                      toast.success("Loaded into the editor below — press Run in sandbox");
                    }}
                  >
                    <FileInput className="mr-1.5 h-3.5 w-3.5" /> Load into editor
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {snippet.runnable ? "Runs standalone" : "Reference only"}
                </span>
              </div>

              <div className="min-w-0 overflow-x-auto rounded-lg border border-border/60 bg-muted/40">
                <pre className="p-3 text-[11px] leading-relaxed sm:text-xs">
                  <code className="font-mono">{snippet.code}</code>
                </pre>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="text-xs text-muted-foreground">
          What this does not do: the issuer key here is generated on the spot. A real issuer signs
          with the assertion key of a published <code className="font-mono">did:prism</code> — mint
          one on the DIDs page, then issue from Credentials, and verifiers resolve the key from the
          DID document instead of being handed a JWK.
        </p>
      </CardContent>
    </Card>
  );
}
