# Why fan-out beats embeddings/RAG here

For reasoning-heavy classification of marketing creative ("what style is this ad? is it discount-led?"), Proofloop dispatches **parallel cheap-model (Haiku) calls**, each asking one focused question and returning structured JSON, then aggregates - *instead of* embedding everything into a vector store and retrieving by similarity. (`packages/core/src/engine/fanout.ts`, run with `pnpm --filter @lift/core fanout`.)

## Measured (36 creatives, concurrency 8, Haiku 4.5)
- **Accuracy:** 100% agreement with the intended style label.
- **Latency:** ~8.9s wall vs ~1.4s/call × 36 ⇒ **~6× speedup** from the bounded worker pool.
- **Cost:** ~$0.008 total. No vector index to build, store, or keep fresh.

## Why fan-out, not embeddings
- **Reliability** - embeddings capture surface similarity, not the *judgment* we need ("does this lead with a discount?", "is this on-brand for premium?"). A small model reasoning about one focused question is more accurate than nearest-neighbor lookup.
- **Cost/latency** - Haiku-class calls are cheap and embarrassingly parallel; standing up + indexing + querying a vector DB is more moving parts for worse results on this task.
- **Simplicity** - no embedding drift, no retrieval tuning, no extra service. Cost scales linearly and predictably.

This design keeps model usage proportional to task complexity: Haiku for bulk classification and Sonnet for reasoning-heavy orchestration. It avoids introducing a vector database for a bounded classification problem.

## When embeddings *would* win
Pure semantic *retrieval* over a large, slowly-changing corpus (e.g., "find the 5 most similar past campaigns to this brief") is a good fit for embeddings. Proofloop uses neither here because the task is bounded reasoning, not open-ended retrieval - knowing *when not* to reach for a vector store is the point.
