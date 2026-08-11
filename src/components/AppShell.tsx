import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Overview" },
  { to: "/app/agents", label: "Agents" },
  { to: "/app/dids", label: "DIDs" },
  { to: "/app/credentials", label: "Credentials" },
  { to: "/app/activity", label: "Activity" },
] as const;

export function AppShell({
  children,
  onSignOut,
  email,
}: {
  children: ReactNode;
  onSignOut: () => void;
  email?: string | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
          <Link to="/" className="font-display text-base font-semibold tracking-tight">
            Identus<span className="text-primary">.</span>Companion
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {nav.map((item) => {
              const active =
                item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/docs"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {email ? (
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                {email}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
