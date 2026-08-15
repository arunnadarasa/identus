import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Github, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const GITHUB_URL = "https://github.com/arunnadarasa/identus";

const LINKS = [
  { to: "/learn", label: "Learn" },
  { to: "/nhs", label: "NHS" },
  { to: "/docs", label: "Docs" },
] as const;

type MarketingHeaderProps = {
  /** Container width, matched to the page's own content column. */
  maxWidth?: "5xl" | "6xl";
  /** The landing page shows the wordmark as plain text; other pages link home. */
  linkHome?: boolean;
};

/**
 * Shared public-site header. Below `sm` it collapses to the wordmark plus a
 * single burger button so the wordmark never has to truncate; from `sm` up it
 * is the usual inline nav.
 */
export function MarketingHeader({ maxWidth = "5xl", linkHome = true }: MarketingHeaderProps) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signedIn = Boolean(session);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const wordmark = (
    <>
      Identus<span className="text-primary">.</span>Companion
    </>
  );

  return (
    <header className="border-b border-border/60">
      <div
        className={`mx-auto grid ${
          maxWidth === "6xl" ? "max-w-6xl" : "max-w-5xl"
        } grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:justify-between sm:px-6 sm:py-5`}
      >
        {linkHome ? (
          <Link
            to="/"
            className="font-display min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg"
          >
            {wordmark}
          </Link>
        ) : (
          <span className="font-display min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">
            {wordmark}
          </span>
        )}

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex sm:flex-wrap">
          {LINKS.map((item) => (
            <Button key={item.to} asChild variant="ghost" size="sm">
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
          <Button asChild variant="ghost" size="icon" aria-label="View on GitHub">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="sm">
            <Link to={signedIn ? "/app" : "/auth"}>Open console</Link>
          </Button>
          {signedIn ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          ) : null}
        </nav>

        {/* Mobile burger */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild className="sm:hidden">
            <Button variant="outline" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
            <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
              <SheetTitle className="font-display text-base">{wordmark}</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-4">
              {LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                GitHub
              </a>
              <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-4">
                <Button asChild onClick={() => setMenuOpen(false)}>
                  <Link to={signedIn ? "/app" : "/auth"}>Open console</Link>
                </Button>
                {signedIn ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMenuOpen(false);
                      void handleSignOut();
                    }}
                  >
                    Sign out
                  </Button>
                ) : null}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
