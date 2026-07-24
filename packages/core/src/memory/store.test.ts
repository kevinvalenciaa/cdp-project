import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Memory, MemoryPoisoningError } from "./store.js";

const path = join(tmpdir(), `memory-test-${process.pid}.duckdb`);

afterAll(() => {
  try {
    unlinkSync(path);
  } catch {
    /* already gone */
  }
});

const REC = {
  runId: "r1",
  subject: "CAMP_X",
  subjectType: "campaign" as const,
  claim: "no lift",
  verdict: "no_significant_lift",
  evidence: JSON.stringify({ runIds: ["r1"], fingerprints: ["f1"] }),
  confidence: 0.8,
};

describe("Memory", () => {
  it("write sets lastValidated = createdAt (a fresh write IS a validation)", async () => {
    const m = await Memory.open(path);
    const rec = await m.write(REC);
    expect(rec.lastValidated).toBe(rec.createdAt);
    const [read] = await m.getValid();
    expect(read?.lastValidated).toBe(rec.createdAt);
    m.close();
  });

  it("gate still refuses unverified verdicts", async () => {
    const m = await Memory.open(path);
    await expect(m.write({ ...REC, subject: "BAD", verdict: "vibes" })).rejects.toThrow(MemoryPoisoningError);
    m.close();
  });

  it("revalidate advances last_validated and updates confidence", async () => {
    const m = await Memory.open(path);
    const rec = await m.write({ ...REC, subject: "CAMP_Y" });
    await new Promise((r) => setTimeout(r, 5));
    await m.revalidate(rec.id, 0.85);
    const read = (await m.getValid()).find((r) => r.subject === "CAMP_Y");
    expect(read?.confidence).toBeCloseTo(0.85);
    expect(Date.parse(read!.lastValidated)).toBeGreaterThan(Date.parse(rec.createdAt));
    m.close();
  });

  it("supersede-per-subject still holds (one live record)", async () => {
    const m = await Memory.open(path);
    await m.write({ ...REC, subject: "CAMP_Z", claim: "old" });
    await m.write({ ...REC, subject: "CAMP_Z", claim: "new" });
    const matches = (await m.getValid()).filter((r) => r.subject === "CAMP_Z");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.claim).toBe("new");
    m.close();
  });

  it("evidence round-trips runIds + fingerprints", async () => {
    const m = await Memory.open(path);
    await m.write({ ...REC, subject: "CAMP_W" });
    const read = (await m.getValid()).find((r) => r.subject === "CAMP_W");
    const ev = JSON.parse(read!.evidence);
    expect(ev.runIds).toEqual(["r1"]);
    expect(ev.fingerprints).toEqual(["f1"]);
    m.close();
  });
});
