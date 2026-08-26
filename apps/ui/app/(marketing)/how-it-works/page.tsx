import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { marked } from "marked";
import { FlywheelDiagram, PipelineDiagram } from "@/components/marketing/Diagrams";

function explainerHtml(): string {
  const md = readFileSync(resolve(process.cwd(), "../../docs/EXPLAINER.md"), "utf8");
  return marked.parse(md, { async: false }) as string;
}

export default function HowItWorks() {
  const html = explainerHtml();
  return (
    <main className="min-h-dvh bg-[#e9eef5] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl rounded-[26px] border border-white/80 bg-background p-5 shadow-ht-md sm:p-8 lg:p-10">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition-colors hover:text-ht-teal-hover">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the app
        </Link>

        <h1 className="mt-8 font-display text-4xl font-semibold tracking-[-0.035em] text-foreground">How Proofloop works</h1>
        <p className="mt-2 text-muted-foreground">
          An Agentic CDP that finds proven opportunities, drafts the work, and learns every run.
        </p>

        <div className="mt-8 space-y-6">
          <PipelineDiagram />
          <FlywheelDiagram />
        </div>

        <article className="md mt-10 border-t border-border pt-8" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
