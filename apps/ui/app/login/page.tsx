import { LoginClient } from "./LoginClient";
import { isSupabaseConfigured } from "@/server/supabase";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // /auth/callback redirects here with ?error=... when a magic link is expired,
  // already consumed, or missing its code. Without surfacing it the user just
  // bounced back to a blank sign-in form with no idea what went wrong.
  const params = await searchParams;
  const raw = params.error;
  const error = Array.isArray(raw) ? raw[0] : raw;
  return <LoginClient configured={isSupabaseConfigured()} error={error ?? null} />;
}
