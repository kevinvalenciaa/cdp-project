import { describe, expect, it } from "vitest";
import boardData from "../../../public/board.json";
import type { ActivationEvent, RunDetail } from "@/lib/types";
import { demoProvider } from "./demo-provider";

const RUN = boardData as unknown as RunDetail;
const FIXTURE_KEY = RUN.activation!.opportunity.key;
const OTHER_KEY = RUN.opportunities.ranked.map((item) => item.key).find((key) => key !== FIXTURE_KEY)!;

async function collect(stream: AsyncGenerator<ActivationEvent>): Promise<ActivationEvent[]> {
  const events: ActivationEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function pick<K extends ActivationEvent["kind"]>(
  events: ActivationEvent[],
  kind: K,
): Extract<ActivationEvent, { kind: K }> {
  const found = events.find((event): event is Extract<ActivationEvent, { kind: K }> => event.kind === kind);
  if (!found) throw new Error(`the stream emitted no ${kind} event`);
  return found;
}

describe("demoProvider.streamActivation", () => {
  it("activates the opportunity that was actually requested", async () => {
    // The regression: streamActivation discarded its `key` and always returned the
    // fixture's single ActivationResult. The route binds the result to the
    // caller's occurrenceId, so approving any other opportunity recorded a
    // different campaign - /launched showed one the user never approved, while
    // /opportunities marked the one they did approve as live.
    const controller = new AbortController();
    const events = await collect(demoProvider.streamActivation(OTHER_KEY, controller.signal));

    const started = pick(events, "act_started");
    const finished = pick(events, "act_finished");
    const expected = RUN.opportunities.ranked.find((item) => item.key === OTHER_KEY)!;

    expect(finished.result.opportunity.key).toBe(OTHER_KEY);
    expect(started.title).toBe(expected.title);
    expect(finished.result.measurement.upliftPp).toBeCloseTo(expected.upliftPp ?? 0, 5);
    expect(finished.result.audience.label).toBe(expected.segment);
  }, 20_000);

  it("still returns the bundled fixture for the opportunity it belongs to", async () => {
    const finished = pick(await collect(demoProvider.streamActivation(FIXTURE_KEY)), "act_finished");
    expect(finished.result.opportunity.key).toBe(FIXTURE_KEY);
    expect(finished.result.sync?.destination).toBe(RUN.activation!.sync?.destination);
  }, 20_000);

  it("stops streaming once the request is aborted", async () => {
    const controller = new AbortController();
    const stream = demoProvider.streamActivation(OTHER_KEY, controller.signal);
    const first = await stream.next();
    expect(first.done).toBe(false);
    controller.abort();
    // sleep() resolves rather than rejects on abort, and the generator returns
    // instead of emitting a stale event.
    await expect(stream.next()).resolves.toMatchObject({ done: true });
  });
});
