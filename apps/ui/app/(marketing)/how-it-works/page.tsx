import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { marked } from "marked";

// Rendered at build/request time from the single source of truth.
function explainerHtml(): string {
  const md = readFileSync(resolve(process.cwd(), "../../docs/EXPLAINER.md"), "utf8");
  return marked.parse(md, { async: false }) as string;
}

export default function HowItWorks() {
  const html = explainerHtml();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-sky-400 transition-colors hover:text-sky-300">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the app
      </Link>
      <article className="md mt-6" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
