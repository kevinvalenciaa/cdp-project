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

export async function getRequestContext(options: { redirectToLogin?: boolean } = {}): Promise<RequestContext> {
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
  const cookieStore = await cookies();
  const preferredWorkspaceId = cookieStore.get("lift-workspace-id")?.value;

  if (!isSupabaseConfigured()) {
    const repository = await getInvestigationRepository();
    return repository.resolveWorkspace(DEV_USER, preferredWorkspaceId);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (options.redirectToLogin) redirect("/login");
    throw new AuthenticationError("Authentication required.");
  }
  const repository = await getInvestigationRepository();
  return repository.resolveWorkspace(
    { id: data.user.id, email: data.user.email ?? "unknown@example.com" },
    preferredWorkspaceId,
  );
}
