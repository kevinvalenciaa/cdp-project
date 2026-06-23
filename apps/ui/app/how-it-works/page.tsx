import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { marked } from "marked";

// Rendered at build time (static export) from the single source of truth.
function explainerHtml(): string {
  const md = readFileSync(resolve(process.cwd(), "../../docs/EXPLAINER.md"), "utf8");
  return marked.parse(md, { async: false }) as string;
}

export default function HowItWorks() {
  const html = explainerHtml();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="text-sm text-sky-400 underline">
        ← Back to the board
      </Link>
      <article className="md mt-6" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
