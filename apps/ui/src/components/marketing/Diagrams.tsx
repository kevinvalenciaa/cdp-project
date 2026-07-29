import { ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "agent" | "human" | "feedback" | "context";

const TONE: Record<Tone, string> = {
  agent: "bg-ht-green-bg border-ht-green-border text-ht-green",
  human: "bg-sky-50 border-sky-300 text-sky-800",
  feedback: "bg-ht-100 border-ht-300 text-ht-700",
  context: "bg-ht-50 border-ht-300 text-ht-700",
};

function Node({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 px-3 py-2 text-center font-display text-[15px] leading-tight shadow-ht-xs",
        TONE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

function Arrow({ down, label }: { down?: boolean; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1 text-muted-foreground", down ? "flex-col py-1" : "px-1")}>
      {label && <span className="font-display text-xs text-muted-foreground">{label}</span>}
      <ArrowRight className={cn("h-5 w-5 shrink-0", down && "rotate-90")} aria-hidden />
    </div>
  );
}

/** "Inside the Agentic CDP" — the engine pipeline with a feedback loop. */
export function PipelineDiagram() {
  return (
    <figure className="rounded-2xl border border-dashed border-ht-300 bg-ht-50/50 p-5">
      <figcaption className="mb-4 font-display text-xl text-foreground">Inside the engine</figcaption>
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        <Node tone="context" className="lg:w-44">
          Your context
          <div className="mt-1 text-[11px] font-normal text-muted-foreground">warehouse · campaigns · goals · brand rules</div>
        </Node>
        <Arrow />
        <div className="rounded-xl border-2 border-ht-green-border bg-ht-green-bg/40 p-3">
          <div className="mb-2 text-center font-display text-sm text-ht-green">agents, always on</div>
          <div className="flex flex-col items-center gap-1.5">
            {["explore — hypotheses worth trying", "investigate — test the evidence", "prioritize — by reach × value × uplift", "verify — reject what doesn't hold"].map(
              (s, i) => (
                <div key={s} className="flex flex-col items-center gap-1.5">
                  {i > 0 && <ArrowRight className="h-3.5 w-3.5 rotate-90 text-ht-green/60" aria-hidden />}
                  <Node tone="agent" className="text-[13px]">
                    {s}
                  </Node>
                </div>
              ),
            )}
          </div>
        </div>
        <Arrow label="ranked list" />
        <Node tone="human" className="lg:w-44">
          You review &amp; approve
        </Node>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-muted-foreground">
        <RotateCcw className="h-4 w-4" aria-hidden />
        <span className="font-display text-sm">verified results feed back as new evidence</span>
      </div>
    </figure>
  );
}

/** The Agentic Marketing flywheel. */
export function FlywheelDiagram() {
  const steps: { tone: Tone; label: string }[] = [
    { tone: "agent", label: "Agentic CDP finds the opportunity" },
    { tone: "agent", label: "drafts the audience, message & holdout" },
    { tone: "human", label: "you review, edit & launch" },
    { tone: "feedback", label: "results become new evidence" },
  ];
  return (
    <figure className="rounded-2xl border border-dashed border-ht-300 bg-ht-50/50 p-5">
      <figcaption className="mb-4 font-display text-xl text-foreground">The flywheel</figcaption>
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 flex-col items-center gap-2 md:flex-row">
            <Node tone={s.tone} className="flex-1">
              {s.label}
            </Node>
            {i < steps.length - 1 && <Arrow />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-muted-foreground">
        <RotateCcw className="h-4 w-4" aria-hidden />
        <span className="font-display text-sm">…and the loop starts smarter every time</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ht-green-border" /> agent / automated</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" /> you / human-in-the-loop</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ht-300" /> context / feedback</span>
      </div>
    </figure>
  );
}
