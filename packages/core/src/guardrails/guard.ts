import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { parse as parseYaml } from "yaml";
import { config } from "../shared/env.js";
import type { CostLedger } from "../shared/cost.js";

export interface Rule {
  id: string;
  rule: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const RULES = (parseYaml(readFileSync(resolve(here, "guardrails.yaml"), "utf8")) as { rules: Rule[] }).rules;

export interface GuardResult {
  allowed: boolean;
  violatedRule: string | null;
  reason: string;
}

export function listRules(): Rule[] {
  return RULES;
}

/**
 * Check a proposed marketing action against the composable-context guardrails.
 * The rules are injected as context (Hightouch's "you control the strategy" surface),
 * so changing guardrails.yaml changes agent behavior with no code change.
 */
export async function checkAction(client: Anthropic, actionText: string, ledger?: CostLedger): Promise<GuardResult> {
  const rulesText = RULES.map((r) => `- [${r.id}] ${r.rule.trim()}`).join("\n");
  const resp = await client.messages.create({
    model: config.models.fanout,
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content:
          `You enforce a fashion brand's marketing guardrails. RULES:\n${rulesText}\n\n` +
          `Proposed marketing action:\n"${actionText}"\n\n` +
          `Does it violate any rule? Reply ONLY compact JSON ` +
          `{"allowed": true|false, "violated_rule": "<rule id>"|null, "reason": "<=18 words"}.`,
      },
    ],
  });
  ledger?.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text);
    const violated = j.violated_rule && String(j.violated_rule) !== "null" ? String(j.violated_rule) : null;
    return { allowed: Boolean(j.allowed) && !violated, violatedRule: violated, reason: String(j.reason ?? "") };
  } catch {
    // Fail-closed on ambiguity for a safety guardrail.
    return { allowed: false, violatedRule: null, reason: "could not parse guardrail verdict; blocking to be safe" };
  }
}
