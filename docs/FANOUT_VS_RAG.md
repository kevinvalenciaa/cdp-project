# Why fan-out beats embeddings/RAG here

*(Fleshed out in Phase 4. Stub so the decision is recorded up front.)*

For reasoning-heavy classification of marketing creative/segments ("Is this ad promotional? UGC? premium-positioned?"), Lift Compass dispatches **hundreds of parallel cheap-model (Haiku) calls**, each asking one specific yes/no question and returning structured JSON, then aggregates — *instead of* embedding everything into a vector store and retrieving by similarity.

**Why:**
- **Reliability** — embeddings capture surface similarity, not the reasoning judgment we need ("does this creative match brand rules?"). A small model *reasoning* about one focused question is more accurate than nearest-neighbor lookup.
- **Cost/latency** — Haiku-class calls are cheap and embarrassingly parallel; no vector DB to stand up, index, or keep fresh.
- **Simplicity** — fewer moving parts, no embedding drift, no retrieval-tuning.

This mirrors Hightouch's stated choice ("embeddings are actually quite dumb" — they fan out to Haiku instead). A naive embeddings baseline is included for comparison so the tradeoff is measured, not asserted. Cost/latency numbers go here once Phase 4 runs.
