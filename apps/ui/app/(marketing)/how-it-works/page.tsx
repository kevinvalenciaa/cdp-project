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
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-ht-teal-hover">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the app
      </Link>

      <h1 className="mt-6 font-display text-4xl text-foreground">How Lift Compass works</h1>
      <p className="mt-2 text-muted-foreground">
        An Agentic CDP that finds proven opportunities, drafts the work, and learns every run.
      </p>

      <div className="mt-8 space-y-6">
        <PipelineDiagram />
        <FlywheelDiagram />
      </div>

      <article className="md mt-10 border-t border-border pt-8" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
