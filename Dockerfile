# Live-mode container: Node 20 + Python 3.11 + uv (the live engine spawns both).
# Demo mode does not need this - deploy demo to Vercel (see vercel.json).
FROM node:20-bookworm

# Python + uv for the stats verifier MCP
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

RUN corepack enable
WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN cd services/stats && uv sync
RUN pnpm --filter @lift/core build
RUN pnpm --filter @lift/core seed          # build the synthetic warehouse + ground truth
RUN pnpm --filter @lift/ui build

ENV LIFT_MODE=live
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ANTHROPIC_API_KEY must be passed at runtime: docker run -e ANTHROPIC_API_KEY=... -p 3000:3000 lift-compass
CMD ["pnpm", "--filter", "@lift/ui", "start"]
