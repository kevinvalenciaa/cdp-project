import { ShieldCheck, Target } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { getProvider } from "@/server/data-provider";
import { MODE } from "@/lib/mode";

export default async function SettingsPage() {
  const provider = await getProvider();
  const [goals, guardrails] = await Promise.all([provider.listGoals(), provider.getGuardrails()]);

  return (
    <>
      <PageHeader title="Settings & Guardrails" description="Business goals and the brand rules the agents must respect — your composable context." />
      <div className="space-y-8 p-5 lg:p-8">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="h-4 w-4" aria-hidden /> Business goals
          </h2>
          <div className="flex flex-wrap gap-2">
            {goals.map((g) => (
              <span key={g.id} className="rounded-full border border-border bg-card/50 px-3 py-1.5 text-sm text-slate-200">
                {g.label}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Guardrails
          </h2>
          <div className="space-y-2">
            {guardrails.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card/40 p-3.5">
                <div className="font-mono text-xs text-amber-300">{r.id}</div>
                <p className="mt-1 text-sm text-slate-300">{r.rule}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Guardrails are injected as context before any recommendation is surfaced. Mode: <span className="font-mono">{MODE}</span>.
          </p>
        </section>
      </div>
    </>
  );
}
