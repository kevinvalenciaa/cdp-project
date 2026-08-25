# How Proofloop works - in plain terms

*Written for a smart person who isn't deep in the tech. The `/how-it-works` page in the app renders this file.*

## What this is, in one sentence

Software that does a marketing analyst's hardest thinking automatically: it digs through a company's customer data, finds the few most valuable things the team should do next, **proves** each one is real with a controlled test, drafts the work, and gets smarter every time it runs.

## The problem it fixes

Today a marketer logs in, builds the audience they already had in mind, launches the campaign they already planned, and logs out - the software never has an idea of its own. And if you ask an AI chatbot "how do I grow sales?", it gives the first plausible-sounding answer, which is often wrong, or just a seasonal blip, or something that would have happened anyway.

Proofloop replaces the blank screen (and the confident guess) with a short, ranked, **proven** to-do list.

## Meet the team (the agents), in plain terms

- **The Explorer** - a brainstormer that proposes ideas worth trying ("maybe one-time buyers come back if we text them an offer"). Ideas it can't test yet are listed honestly as "unexplored" rather than quietly dropped. *(in code: `engine/explorer.ts`)*
- **The Investigators** - detectives, each sent to test one idea against the real data and report back a short summary. *(in code: `engine/engine.ts` per-candidate verification, plus the deep-dive subagent in `harness/subagent.ts`)*
- **The Prioritizer** - the manager who ranks ideas by *how many customers it reaches × how much each is worth × how much lift we proved*. The formula is visible arithmetic, not AI judgment. *(in code: `engine/prioritize.ts`)*
- **The Verifier** - the skeptic, and the most important character. It challenges every idea twice: first with real statistics, then a second check that the written claim matches the evidence. Anything that fails either check is thrown out. *(in code: `services/stats` + `engine/groundedness.ts`)*
- **The helpers** - the **warehouse** (the company's big filing cabinet of data); the **secure doorway (MCP)** the agents must use to read it (read-only, every peek logged); the **statistician** (a small service that runs the real math); the **notebook (memory)** where proven lessons are written down; and the **optimizer (bandit)** that learns which version of a message works best.

## How a run goes, step by step

1. You give it a goal in plain English ("get one-time buyers to buy again").
2. It writes a plan - and is allowed to **change the plan mid-way** when it discovers something surprising (most software can't).
3. The Explorer brainstorms; the strongest ideas go to Investigators.
4. Each Investigator queries the data through the secure doorway and keeps its workspace tidy - big results get filed away, only short summaries stay "in its head" - so it doesn't get lost over a long run.
5. The Prioritizer ranks the survivors by reach × value × likelihood-it-works.
6. **The Verifier checks each one with real statistics:** Is this just a seasonal pattern? Is the change bigger than normal random noise? If we ran a proper test with a control group, would there actually be a lift? Anything that fails is killed, with the reason shown.
7. For the survivors it drafts the work: who to target, what to say, a creative brief, and a plan to measure it with a control group.
8. It **simulates sending** the campaign and **measures whether it actually worked** against a held-back control group - like a drug trial.
9. The optimizer learns which message version works best for each group.
10. It writes the proven result into its notebook - so next time it won't re-suggest a dead end, and starts smarter.

## The one big idea

Most AI confidently tells you things that sound right. This one **refuses to claim anything it can't prove**, and it won't chase a number that would have happened anyway (it measures real *lift over a control group*, not just "this group buys a lot").

To prove it, the demo deliberately plants a **trap** - a group that looks amazing but isn't actually moved by marketing - and you watch the Verifier reject it while a normal AI happily accepts it.

## Why this approach matters

Most customer data tools wait for a marketer to arrive with a fully formed campaign idea. Proofloop instead starts from a business outcome, continuously searches for actionable opportunities, and returns a ranked list backed by evidence and draft activation work.

## What's real vs. pretend (the honest part)

The agents, data queries, statistics, verifier, memory, and optimizer are functional. Customer data is synthetic but realistic, with a known answer key that makes the system testable. Campaign delivery and measured outcomes are simulated, so no real advertisements or messages are sent.
