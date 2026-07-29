import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VectorSchema } from "@lift/protocol";
import { evaluateBundle } from "./eligibility.js";
import type { LedgerEntry } from "./frequency.js";
import { FrequencyLedger } from "./frequency.js";
import { MemoryStorage } from "./storage.js";

/**
 * Replay every golden vector from @lift/protocol/vectors through the real
 * evaluator. The vectors were authored BEFORE this implementation as the spec.
 */

const here = dirname(fileURLToPath(import.meta.url));
const VECTORS_DIR = resolve(here, "../../protocol/vectors");

const files = readdirSync(VECTORS_DIR).filter((f) => f.endsWith(".json"));

describe("golden vectors replay through evaluateBundle", () => {
  it.each(files)("%s", async (f) => {
    const v = VectorSchema.parse(JSON.parse(readFileSync(resolve(VECTORS_DIR, f), "utf8")));

    // Seed the device ledger with the vector's entries, then merge the
    // bundle's server-known recent sends exactly as the client does.
    const ledger = await FrequencyLedger.load(new MemoryStorage());
    for (const e of v.ledger) await ledger.record(e as LedgerEntry);
    const entries = ledger.withRecentSends(v.bundle.recent_sends);

    const decision = evaluateBundle(
      v.bundle,
      {
        userId: v.ctx.user_id,
        deviceId: v.ctx.device_id,
        sessionId: v.ctx.session_id,
        surface: v.ctx.surface,
        attrs: v.ctx.attrs,
        seed: v.ctx.seed,
      },
      entries,
      v.clock,
    );

    expect(decision.outcome).toBe(v.expected.outcome);
    expect(decision.campaign_id).toBe(v.expected.campaign_id);
    if (v.expected.arm_id !== undefined) expect(decision.arm_id).toBe(v.expected.arm_id);
    expect(decision.reason.startsWith(v.expected.reason_prefix)).toBe(true);
  });

  it("found the vector corpus (guards against a silently-empty directory)", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
  });
});
