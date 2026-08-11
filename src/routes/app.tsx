import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agent console — Identus Companion" },
      {
        name: "description",
        content:
          "Manage Identus agents, DIDs, connections and verifiable credentials from one console.",
      },
      { property: "og:title", content: "Agent console — Identus Companion" },
      {
        property: "og:description",
        content: "Manage Identus agents, DIDs and verifiable credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  return (
    <AppShell
      email={user.email ?? undefined}
      onSignOut={async () => {
        await signOut();
        navigate({ to: "/auth" });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
