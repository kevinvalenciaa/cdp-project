import { Brain } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill } from "@/components/common/StatusPill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { verdictMeta } from "@/lib/format";
import { getProvider } from "@/server/data-provider";

export default async function MemoryPage() {
  const provider = await getProvider();
  const insights = await provider.listMemory();

  return (
    <>
      <PageHeader title="Insights" description="Verified insights that compound across runs — only Verifier-passed claims are stored." />
      <div className="p-5 lg:p-8">
        {insights.length === 0 ? (
          <EmptyState icon={Brain} title="No insights yet" description="Verified outcomes are recorded here so the next run starts smarter." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[28%]">Subject</TableHead>
                  <TableHead>Insight</TableHead>
                  <TableHead className="w-[120px]">Verdict</TableHead>
                  <TableHead className="w-[110px] text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insights.map((r, i) => {
                  const m = verdictMeta(r.verdict);
                  return (
                    <TableRow key={`${r.subject}-${i}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.subject}</TableCell>
                      <TableCell className="text-sm text-slate-200">{r.claim}</TableCell>
                      <TableCell>
                        <StatusPill tone={m.tone}>{m.label}</StatusPill>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
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
