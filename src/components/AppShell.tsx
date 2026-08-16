import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Github, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ModeBadge } from "@/components/ModeBadge";
import { useActiveConnection } from "@/hooks/useActiveConnection";

const nav = [
  { to: "/app", label: "Overview" },
  { to: "/app/agents", label: "Agents" },
  { to: "/app/dids", label: "DIDs" },
  { to: "/app/credentials", label: "Credentials" },
  { to: "/app/demos", label: "Agentic demos" },
  { to: "/app/zk", label: "Zero-knowledge" },

  { to: "/app/sandbox", label: "Sandbox" },
  { to: "/app/activity", label: "Activity" },
  { to: "/docs", label: "Docs" },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app";
  return pathname.startsWith(to);
}

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
  const [open, setOpen] = useState(false);
  const active = useActiveConnection();

  // Close the mobile menu whenever navigation happens.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
      {/* Ambient indigo wash so console pages share the marketing depth. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-hero" />
      <header className="glass sticky top-0 z-20 border-b border-border/60">

        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:flex lg:gap-4">
          <Link
            to="/"
            className="font-display min-w-0 truncate text-base font-semibold tracking-tight"
          >
            Identus<span className="text-primary">.</span>Companion
          </Link>

          <ModeBadge
            mode={active?.mode}
            name={active?.fly_app_name ?? active?.name}
            health={active?.last_health}
            className="hidden lg:inline-flex"
          />

          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive(pathname, item.to)
                    ? "bg-primary/12 text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-gradient-primary"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>


          <div className="hidden items-center gap-3 lg:flex">
            {email ? (
              <span className="max-w-[16rem] truncate font-mono text-xs text-muted-foreground">
                {email}
              </span>
            ) : null}
            <Button asChild variant="ghost" size="icon" aria-label="View on GitHub">
              <a href="https://github.com/arunnadarasa/identus" target="_blank" rel="noreferrer">
                <Github className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>

          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <ModeBadge
              mode={active?.mode}
              name={active?.fly_app_name ?? active?.name}
              health={active?.last_health}
              compact
            />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
              <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
                <SheetTitle className="font-display text-base">
                  Identus<span className="text-primary">.</span>Companion
                </SheetTitle>
                {email ? (
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {email}
                  </span>
                ) : null}
                <ModeBadge
                  mode={active?.mode}
                  name={active?.fly_app_name ?? active?.name}
                  health={active?.last_health}
                  className="mt-2 w-full justify-center py-2 text-sm"
                />
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-4 py-3 text-base transition-colors",
                      isActive(pathname, item.to)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-border/60 p-3">
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                >
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
