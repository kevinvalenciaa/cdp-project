import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RequestContext } from "@/lib/investigations";
import { getInvestigationRepository } from "@/server/investigations";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/server/supabase";

const DEV_USER = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "maria@fashionretailer.com",
};

export class AuthenticationError extends Error {}

/**
 * With no Supabase configuration the app runs as a single anonymous owner - that
 * is the zero-config local demo, and it is deliberate. It is also indistinguishable
 * from a production deploy whose secrets failed to inject, which would silently
 * serve every investigation to the public with no log signal.
 *
 * So the anonymous path has to be *chosen*, not merely fallen into: outside
 * development it requires LIFT_PUBLIC_DEMO=true (vercel.json sets it for the
 * shareable demo). Anything else fails closed and loudly.
 */
function anonymousDemoAllowed(): boolean {
  if (process.env.LIFT_PUBLIC_DEMO === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function assertEnvironmentIsCoherent(): void {
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  if (
    hasSupabaseUrl !== hasSupabaseKey ||
    (hasDatabase && !hasSupabaseUrl) ||
    (hasSupabaseUrl && !hasDatabase)
  ) {
    throw new AuthenticationError(
      "DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured together.",
    );
  }
  if (!hasSupabaseUrl && !anonymousDemoAllowed()) {
    throw new AuthenticationError(
      "Refusing to serve anonymously in production. Configure DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or set LIFT_PUBLIC_DEMO=true to run the public demo on purpose.",
    );
  }
}

type Resolution = { ctx: RequestContext } | { unauthenticated: true };

/**
 * Memoized for the lifetime of one request. Without this, rendering a single page
 * called it three times (app layout, section layout, page), and each call is a
 * Supabase Auth round trip plus a write transaction that upserts public.profiles -
 * three serialized network hops on the critical render path, and three dead tuples
 * per page view in a table with one row per user.
 *
 * The `options` argument stays outside the cache: it holds `redirectToLogin`, and
 * redirect() throws a control-flow signal that must not be memoized.
 */
const resolveRequestContext = cache(async (): Promise<Resolution> => {
  assertEnvironmentIsCoherent();
  const cookieStore = await cookies();
  const preferredWorkspaceId = cookieStore.get("lift-workspace-id")?.value;

  if (!isSupabaseConfigured()) {
    const repository = await getInvestigationRepository();
    return { ctx: await repository.resolveWorkspace(DEV_USER, preferredWorkspaceId) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { unauthenticated: true };

  const repository = await getInvestigationRepository();
  return {
    ctx: await repository.resolveWorkspace(
      { id: data.user.id, email: data.user.email ?? "unknown@example.com" },
      preferredWorkspaceId,
    ),
  };
});

export async function getRequestContext(options: { redirectToLogin?: boolean } = {}): Promise<RequestContext> {
  const result = await resolveRequestContext();
  if ("unauthenticated" in result) {
    if (options.redirectToLogin) redirect("/login");
    throw new AuthenticationError("Authentication required.");
  }
  return result.ctx;
}
