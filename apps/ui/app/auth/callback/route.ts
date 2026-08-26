import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginWithError(origin: string, reason: string): Response {
  const target = new URL("/login", origin);
  target.searchParams.set("error", reason);
  return NextResponse.redirect(target);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Supabase reports a rejected link by redirecting here with error params
  // rather than a code.
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return loginWithError(url.origin, providerError);

  const code = url.searchParams.get("code");
  if (!code) {
    return loginWithError(url.origin, "That sign-in link is missing its code. Request a new one.");
  }

  // Previously the result of the exchange was discarded and the handler
  // redirected to /opportunities regardless, so an expired or already-consumed
  // link bounced /auth/callback -> /opportunities -> /login with nothing said.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginWithError(url.origin, "That sign-in link has expired or was already used. Request a new one.");
  }

  return NextResponse.redirect(new URL("/opportunities", url.origin));
}
