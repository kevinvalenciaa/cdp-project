import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";

/**
 * Durable step journal - the same memoize-and-resume semantics as Inngest's `step.run`,
 * implemented on an append-only on-disk journal so a run survives a crash.
 *
 * Each step's result is journaled by name. On resume with the same runId, completed steps
 * return their cached result WITHOUT re-executing (idempotent). Read-only warehouse/stats
 * queries are naturally idempotent, which is what makes this safe. (Inngest/DBOS are the
 * production targets; this externalizes the same state - see docs/DESIGN_DECISIONS.md.)
 */
export class Journal {
  private cache = new Map<string, unknown>();
  private readonly path: string;

  constructor(runId: string) {
    this.path = resolve(REPO_ROOT, "runs", runId, "journal.jsonl");
    mkdirSync(dirname(this.path), { recursive: true });
    if (existsSync(this.path)) {
      for (const line of readFileSync(this.path, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line) as { step: string; result: unknown };
        this.cache.set(rec.step, rec.result);
      }
    }
  }

  completedSteps(): string[] {
    return [...this.cache.keys()];
  }

  /** Run a step once; on resume, return the journaled result without re-executing. */
  async step<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; cached: boolean }> {
    if (this.cache.has(name)) return { result: this.cache.get(name) as T, cached: true };
    const result = await fn();
    appendFileSync(this.path, `${JSON.stringify({ step: name, result, at: new Date().toISOString() })}\n`);
    this.cache.set(name, result);
    return { result, cached: false };
  }
}

/** Signals a simulated crash (the journal up to this point is already on disk). */
export class CrashError extends Error {}
