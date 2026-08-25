import { ShieldCheck, Target } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { getProvider } from "@/server/data-provider";
import { MODE } from "@/lib/mode";

export default async function SettingsPage() {
  const provider = await getProvider();
  const [goals, guardrails] = await Promise.all([provider.listGoals(), provider.getGuardrails()]);

  return (
    <>
      <PageHeader title="Settings & Guardrails" description="Business goals and the brand rules the agents must respect - your composable context." />
      <div className="app-page">
        <section className="surface-panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ht-teal-tint"><Target className="h-4 w-4 text-ht-teal" aria-hidden /></span> Business goals
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {goals.map((g) => (
              <span key={g.id} className="rounded-full border border-border bg-background px-3.5 py-2 text-sm text-foreground">
                {g.label}
              </span>
            ))}
          </div>
        </section>

        <section className="surface-panel p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ht-green-bg"><ShieldCheck className="h-4 w-4 text-ht-green" aria-hidden /></span> Guardrails
          </h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {guardrails.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="font-mono text-xs text-ht-warning">{r.id}</div>
                <p className="mt-1 text-sm text-muted-foreground">{r.rule}</p>
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
