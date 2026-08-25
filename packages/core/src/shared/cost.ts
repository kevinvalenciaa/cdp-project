/** Per-model pricing (USD per 1M tokens) for the cost ledger - proves cost-tiering. */
const PRICES: { match: RegExp; input: number; output: number }[] = [
  { match: /haiku/i, input: 1, output: 5 },
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /opus/i, input: 5, output: 25 },
  { match: /fable/i, input: 10, output: 50 },
];

function price(model: string): { input: number; output: number } {
  return PRICES.find((p) => p.match.test(model)) ?? { input: 3, output: 15 };
}

export class CostLedger {
  private entries: { model: string; input: number; output: number }[] = [];

  add(model: string, inputTokens: number, outputTokens: number): void {
    this.entries.push({ model, input: inputTokens, output: outputTokens });
  }

  totalUsd(): number {
    return this.entries.reduce((sum, e) => {
      const p = price(e.model);
      return sum + (e.input / 1e6) * p.input + (e.output / 1e6) * p.output;
    }, 0);
  }

  /** Aggregate by model (for the trace / run.json). */
  byModel(): Record<string, { calls: number; inputTokens: number; outputTokens: number; usd: number }> {
    const out: Record<string, { calls: number; inputTokens: number; outputTokens: number; usd: number }> = {};
    for (const e of this.entries) {
      const p = price(e.model);
      const row = (out[e.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });
      row.calls += 1;
      row.inputTokens += e.input;
      row.outputTokens += e.output;
      row.usd += (e.input / 1e6) * p.input + (e.output / 1e6) * p.output;
    }
    return out;
  }
}
