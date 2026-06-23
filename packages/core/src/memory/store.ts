import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import { Db, num } from "../shared/db.js";

/** Verdicts that come from the Verifier — only these may be written (the gate). */
const VERIFIED_VERDICTS = new Set(["real_lift", "no_significant_lift", "explained_by_seasonality", "needs_test"]);

export type SubjectType = "initiative" | "audience" | "journey" | "campaign" | "message";

export interface InsightRecord {
  id: string;
  runId: string;
  subject: string;
  subjectType: SubjectType;
  claim: string;
  verdict: string;
  evidence: string;
  confidence: number;
  createdAt: string;
  validUntil: string;
}

const VALIDITY_DAYS = 90;
const DEFAULT_PATH = resolve(REPO_ROOT, "packages/core/data/memory.duckdb");

/** Thrown when an unverified claim is rejected by the write gate. */
export class MemoryPoisoningError extends Error {}

/**
 * Compounding, multi-level memory. Typed insight records (not raw embeddings), keyed by
 * subject across initiative/audience/journey/campaign/message, with a VERIFIED-ONLY write
 * gate (prevents memory poisoning by unverified claims) and temporal validity.
 */
export class Memory {
  private constructor(private readonly db: Db) {}

  static async open(path = DEFAULT_PATH): Promise<Memory> {
    mkdirSync(dirname(path), { recursive: true });
    const db = await Db.open(path);
    await db.run(`CREATE TABLE IF NOT EXISTS insights (
      id VARCHAR, run_id VARCHAR, subject VARCHAR, subject_type VARCHAR, claim VARCHAR,
      verdict VARCHAR, evidence VARCHAR, confidence DOUBLE, created_at VARCHAR, valid_until VARCHAR
    )`);
    return new Memory(db);
  }

  /** Write a VERIFIED insight. Throws if the claim was not produced by the Verifier. */
  async write(rec: Omit<InsightRecord, "id" | "createdAt" | "validUntil">): Promise<InsightRecord> {
    if (!VERIFIED_VERDICTS.has(rec.verdict)) {
      throw new MemoryPoisoningError(
        `refused to write unverified claim about '${rec.subject}' (verdict='${rec.verdict}'). Only Verifier-passed claims may enter memory.`,
      );
    }
    const createdAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + VALIDITY_DAYS * 86_400_000).toISOString();
    const id = `${rec.subject}:${createdAt}`;
    // One current record per subject — supersede older ones.
    await this.db.run(`DELETE FROM insights WHERE subject = '${rec.subject.replace(/'/g, "''")}'`);
    await this.db.insertRows(
      "insights",
      ["id", "run_id", "subject", "subject_type", "claim", "verdict", "evidence", "confidence", "created_at", "valid_until"],
      [[id, rec.runId, rec.subject, rec.subjectType, rec.claim, rec.verdict, rec.evidence, rec.confidence, createdAt, validUntil]],
    );
    return { id, createdAt, validUntil, ...rec };
  }

  /** Still-valid insights (valid_until in the future), most recent first. */
  async getValid(): Promise<InsightRecord[]> {
    const now = new Date().toISOString();
    const rows = await this.db.all<Record<string, unknown>>(
      `SELECT * FROM insights WHERE valid_until > '${now}' ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      runId: String(r.run_id),
      subject: String(r.subject),
      subjectType: String(r.subject_type) as SubjectType,
      claim: String(r.claim),
      verdict: String(r.verdict),
      evidence: String(r.evidence),
      confidence: num(r.confidence),
      createdAt: String(r.created_at),
      validUntil: String(r.valid_until),
    }));
  }

  async count(): Promise<number> {
    return num(await this.db.scalar("SELECT count(*) FROM insights"));
  }

  async clear(): Promise<void> {
    await this.db.run("DELETE FROM insights");
  }

  close(): void {
    this.db.close();
  }
}
