import Link from "next/link";
import { Archive, ArrowRight, MessageSquareText, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const dynamic = "force-dynamic";

export default async function InvestigationsPage() {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const investigations = await repository.listInvestigations(ctx, { limit: 100 });
  return (
    <>
      <PageHeader
        title="Investigations"
        description="Persistent conversations, their run state, and the proven opportunities they produced."
        actions={
          <Link
            href="/opportunities/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New investigation
          </Link>
        }
      />
      <div className="p-5 lg:p-8">
        <div className="space-y-2">
          {investigations.map((investigation) => (
            <Link
              key={investigation.id}
              href={`/opportunities/${investigation.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-ht-xs transition-colors hover:border-ht-400"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ht-teal-tint">
                {investigation.status === "archived" ? (
                  <Archive className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <MessageSquareText className="h-4 w-4 text-ht-teal" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{investigation.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {investigation.provenCount} proven · updated {new Date(investigation.lastActivityAt).toLocaleString()}
                </span>
              </span>
              {investigation.activeRunStatus && (
                <span className="rounded-full bg-ht-green-bg px-2 py-1 text-xs text-ht-green">
                  {investigation.activeRunStatus}
                </span>
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {investigations.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No investigations yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
