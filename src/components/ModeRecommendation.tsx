import { useEffect, useState } from "react";
import { Cloud, X, Info, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = "agent-hosting" | "sdk-sandbox";

interface ModeRecommendationProps {
  variant: Variant;
  className?: string;
}

const STORAGE_KEYS: Record<Variant, string> = {
  "agent-hosting": "identus-dismissed-agent-rec",
  "sdk-sandbox": "identus-dismissed-sandbox-rec",
};

const CONTENT: Record<
  Variant,
  {
    icon: React.ReactNode;
    title: string;
    badge: string;
    body: React.ReactNode;
  }
> = {
  "agent-hosting": {
    icon: <Cloud className="h-4 w-4 text-primary" />,
    title: "Recommended: Fly Machines for Cloud Agents",
    badge: "Recommended",
    body: (
      <>
        <p>
          A real Identus Cloud Agent needs three services working together: Postgres, a PRISM
          node, and the agent itself. Fly Machines can run all three as a composed stack with a
          public HTTPS endpoint and health checks.
        </p>
        <p>
          Use <strong>Simulated</strong> only for in-app exploration, and <strong>Docker local</strong>{" "}
          when you are running the stack on your own machine.
        </p>
      </>
    ),
  },
  "sdk-sandbox": {
    icon: <Terminal className="h-4 w-4 text-primary" />,
    title: "Sprites is for SDK snippets only",
    badge: "Sandbox",
    body: (
      <>
        <p>
          Sprites.dev gives you a disposable Linux box for running Identus TypeScript SDK code. It
          cannot host a Cloud Agent because it does not run Docker images or multi-service
          composition.
        </p>
        <p>
          Snippets still receive <code>AGENT_BASE_URL</code> and <code>AGENT_API_KEY</code> from your
          active agent — choose Simulated, Docker local, or Fly on the Agents page.
        </p>
      </>
    ),
  },
};

export function ModeRecommendation({ variant, className }: ModeRecommendationProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEYS[variant]) === "1");
    } catch {
      setDismissed(false);
    }
  }, [variant]);

  if (dismissed) return null;

  const content = CONTENT[variant];

  return (
    <Card className={cn("border-primary/30 bg-primary/5", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
            {content.icon}
          </div>
          <CardTitle className="font-display text-base">{content.title}</CardTitle>
          <Badge variant="outline" className="border-primary/40 text-xs text-primary">
            {content.badge}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Dismiss recommendation"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEYS[variant], "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-2">{content.body}</div>
        </div>
      </CardContent>
    </Card>
  );
}
