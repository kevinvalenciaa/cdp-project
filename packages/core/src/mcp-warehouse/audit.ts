import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";

export const AUDIT_PATH = resolve(REPO_ROOT, "packages/core/mcp-warehouse/audit.log");

/** Append a structured, append-only audit record for every tool call. */
export function audit(entry: Record<string, unknown>): void {
  mkdirSync(dirname(AUDIT_PATH), { recursive: true });
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}
