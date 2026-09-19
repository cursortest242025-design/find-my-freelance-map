import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

// Lovable's hosted sign-in helper only exists on Lovable domains. When the app runs
// locally (or on your own hosting) we go straight to the Google provider with the
// credentials configured in .env, so "Join the map" works everywhere.
function useHostedSignIn() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host.endsWith("lovable.app") || host.endsWith("lovableproject.com") || host.endsWith("lovable.dev");
}

export async function signInWithGoogle(): Promise<{ error?: { message: string } }> {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  if (useHostedSignIn()) {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) return { error: { message: result.error.message } };
    return {};
  }

  const scopes = import.meta.env['VITE_GOOGLE_OAUTH_SCOPES'] as string | undefined;
  const redirectTo = (import.meta.env['VITE_GOOGLE_REDIRECT_URI'] as string | undefined) || `${origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      ...(scopes ? { scopes } : {}),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) return { error: { message: error.message } };
  return {};
}
