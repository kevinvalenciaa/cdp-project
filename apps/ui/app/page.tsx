import Link from "next/link";
import boardData from "../public/board.json";
import type { Board, Opportunity } from "./types";

const board = boardData as unknown as Board;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const money = (x: number) => `$${Math.round(x).toLocaleString()}`;

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-800 text-slate-300 ring-slate-700",
    green: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    red: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

function liftLabel(o: Opportunity) {
  if (o.upliftPp == null) return "—";
  const ci = o.ci ? ` · CI [${o.ci[0].toFixed(1)}, ${o.ci[1].toFixed(1)}]` : "";
  const p = o.pValue == null ? "" : ` · p=${o.pValue.toFixed(3)}`;
  return `${o.upliftPp >= 0 ? "+" : ""}${o.upliftPp.toFixed(1)}pp${ci}${p}`;
}

export default function Page() {
  const { ranked, rejected } = board.opportunities;
  const a = board.activation;
  const b = board.bandit;
  const trap = rejected.find((o) => o.key === "VIP_LOYALTY_BLAST");

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Lift Compass</h1>
          <p className="mt-1 max-w-2xl text-slate-400">
            A causally-credible Agentic CDP — ranks opportunities by <span className="text-slate-200">reach × value × uplift</span> and proves each with a holdout.
          </p>
          <p className="mt-2 text-sm text-slate-500">Goal: “{board.goal}”</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href="/how-it-works" className="text-sm text-sky-400 underline">
            How it works →
          </Link>
          <div className="flex gap-2">
            <Pill tone="amber">Prototype · synthetic data</Pill>
            <Pill>seed {board.generatedAtSeed}</Pill>
          </div>
        </div>
      </header>

      {/* The contrast — the money shot */}
      {trap && trap.bareLlm && (
        <section className="mb-8 rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-300">The trap a normal AI falls for</div>
          <div className="mt-2 text-lg font-medium text-white">{trap.title} — {pct((trap.rawConversion ?? 0) / 100)} conversion</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-900/60 p-3">
              <Pill tone="red">Bare LLM: ACCEPT</Pill>
              <p className="mt-2 text-sm text-slate-300">“{trap.bareLlm.reason}”</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 p-3">
              <Pill tone="green">Verifier: REJECT</Pill>
              <p className="mt-2 text-sm text-slate-300">{trap.reason}</p>
            </div>
          </div>
        </section>
      )}

      {/* Ranked opportunities */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Ranked opportunities (verified incremental lift)</h2>
        <div className="space-y-3">
          {ranked.map((o, i) => (
            <div key={o.key} className="rounded-xl border border-emerald-500/20 bg-slate-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">#{i + 1}</span>
                    <span className="font-semibold text-white">{o.title}</span>
                    <Pill tone="green">verified</Pill>
                  </div>
                  <div className="mt-1 text-sm text-slate-400">{o.segment}</div>
                </div>
                <div className="text-right text-sm text-slate-400">
                  reach <span className="text-slate-200">{o.reach.toLocaleString()}</span> · value <span className="text-slate-200">{money(o.value)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Pill tone="sky">lift {liftLabel(o)}</Pill>
                <span className="text-slate-500">{o.reason}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Demoted / rejected */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Demoted / rejected (with reasons)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {rejected.map((o) => (
            <div key={o.key} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-200">{o.title}</span>
                <Pill tone={o.verdict === "needs_test" ? "amber" : "red"}>{o.verdict}</Pill>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{o.reason}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Activation */}
      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Activation — draft work → assets → launch → measure</h2>
        <div className="mb-4 text-lg font-medium text-white">{a.opportunity.title}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-500">Audience</div>
            <p className="mt-1 text-sm text-slate-300">
              {a.audience.label} — <span className="text-slate-200">{a.audience.reach.toLocaleString()}</span> reach,{" "}
              <span className="text-emerald-300">{a.audience.persuadableReach.toLocaleString()} persuadable</span> ({a.audience.channel})
            </p>
            <div className="mt-3 text-xs uppercase text-slate-500">Creative brief</div>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">{a.brief}</pre>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Message variants (AMP-analog)</div>
            <div className="mt-1 space-y-2">
              {a.variants.map((v) => (
                <div key={v.id} className="rounded-lg bg-slate-950/60 p-3 text-sm text-slate-200">
                  <span className="mr-2 text-slate-500">{v.id}</span>
                  {v.text}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="green">guardrail clear</Pill>
              {a.sync && <Pill tone="sky">synced → {a.sync.destination} (simulated)</Pill>}
            </div>
            <div className="mt-3 text-xs uppercase text-slate-500">Measured outcome (holdout)</div>
            <p className="mt-1 text-sm text-slate-300">
              treatment {a.measurement.treatmentConv}/{a.measurement.treatmentN} vs control {a.measurement.controlConv}/{a.measurement.controlN} →{" "}
              <span className="text-emerald-300">+{a.measurement.upliftPp.toFixed(1)}pp</span> (p={a.measurement.pValue.toFixed(3)}, {a.measurement.verdict})
            </p>
          </div>
        </div>
      </section>

      {/* Bandit */}
      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">AI-Decisioning bandit — best message per segment</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {b.learnedBest.map((variant, i) => (
            <div key={i} className="rounded-lg bg-slate-950/60 p-3 text-sm">
              <span className="text-slate-500">{["vip", "mid", "low"][i]}</span>
              <div className="font-medium text-slate-200">{variant}</div>
              <Pill tone={variant === b.oracleBest[i] ? "green" : "red"}>{variant === b.oracleBest[i] ? "optimal ✓" : "off"}</Pill>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Pill tone="sky">+{(b.liftVsHoldout * 100).toFixed(1)}% vs holdout</Pill>
          <Pill tone="sky">+{(b.liftVsGlobalBest * 100).toFixed(1)}% vs human marketing</Pill>
          <span className="text-slate-500">bandit {pct(b.banditRate)} · oracle {pct(b.oracleRate)} · random {pct(b.randomRate)}</span>
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-800 pt-5 text-xs text-slate-500">
        Prototype of Hightouch&apos;s Agentic CDP vision. Agents, queries, statistics, verifier, memory, and bandit are real; the
        customer data is synthetic (with a known answer key) and activation/outcomes are simulated. The harness is context-engineering,
        not RL — the bandit is a separate AI-Decisioning analog.
      </footer>
    </main>
  );
}
