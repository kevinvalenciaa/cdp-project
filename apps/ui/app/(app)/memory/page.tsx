import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill } from "@/components/common/StatusPill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { verdictMeta } from "@/lib/format";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export default async function MemoryPage() {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const insights = await repository.listInsights(ctx);

  return (
    <>
      <PageHeader title="Insights" description="Verified insights that compound across runs - only Verifier-passed claims are stored." />
      <div className="app-page">
        {insights.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No insights yet"
            description="Verified outcomes are recorded here so the next run starts smarter - and skips what has already been ruled out."
            action={
              <Button asChild>
                <Link href="/investigations">
                  Run a discovery <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="surface-panel overflow-hidden">
            <Table>
              <caption className="sr-only">
                Verified insights carried between runs, with the Verifier&apos;s verdict and confidence for each.
              </caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="w-[28%]">
                    Subject
                  </TableHead>
                  <TableHead scope="col">Insight</TableHead>
                  <TableHead scope="col" className="w-[120px]">
                    Verdict
                  </TableHead>
                  <TableHead scope="col" className="w-[110px] text-right">
                    Confidence
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insights.map((r, i) => {
                  const m = verdictMeta(r.verdict);
                  return (
                    <TableRow key={`${r.subject}-${i}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.subject}</TableCell>
                      <TableCell className="text-sm text-foreground">{r.claim}</TableCell>
                      <TableCell>
                        <StatusPill tone={m.tone}>{m.label}</StatusPill>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums text-muted-foreground">
                        {(r.confidence * 100).toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
