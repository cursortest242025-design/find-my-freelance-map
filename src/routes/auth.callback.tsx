import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing you in | Atlaswork" },
      { name: "description", content: "Completing your Atlaswork sign-in and returning you to the world map." },
      { property: "og:title", content: "Signing you in | Atlaswork" },
      { property: "og:description", content: "Completing your Atlaswork sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      // Supabase parses the code/hash from the URL when the client loads.
      await supabase.auth.getSession();
      if (cancelled) return;
      void router.navigate({ to: "/", replace: true });
    }
    void finish();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </main>
  );
}
