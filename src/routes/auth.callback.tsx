import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Completing sign-in — Identus Companion" },
      {
        name: "description",
        content: "Finishing your sign-in and opening the Identus agent console.",
      },
      { property: "og:title", content: "Completing sign-in — Identus Companion" },
      {
        property: "og:description",
        content: "Finishing your sign-in and opening the Identus agent console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

/** Returns the saved destination only when it is a safe, same-origin path. */
function savedDestination(): string {
  try {
    const value = sessionStorage.getItem("identus:post-auth");
    sessionStorage.removeItem("identus:post-auth");
    if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  } catch {
    /* ignore */
  }
  return "/app";
}

function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      navigate({ to: savedDestination(), replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    // The session should arrive within a couple of seconds of the redirect.
    const timeout = setTimeout(async () => {
      if (done) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        go();
        return;
      }
      setFailed(true);
      toast.error("Sign-in didn't complete. Please try again.");
      navigate({ to: "/auth", replace: true });
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {!failed ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
        <span>{failed ? "Returning to sign-in…" : "Completing sign-in…"}</span>
      </div>
    </main>
  );
}
