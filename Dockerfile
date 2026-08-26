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
# Build the libraries topologically (protocol -> sdk -> core) before anything that
# resolves them through their dist entrypoints. .dockerignore strips **/dist, so
# nothing arrives prebuilt in the build context.
RUN pnpm --filter "./packages/**" build
RUN pnpm --filter @lift/core seed          # build the synthetic warehouse + ground truth

# Next inlines NEXT_PUBLIC_* at build time, so Supabase credentials have to be
# present here - supplying them only via env_file at run time leaves the browser
# client holding `undefined` and no one can sign in. Omit them to build the
# no-auth demo image; docker-compose.worker.yml passes them through as build args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
RUN pnpm --filter @lift/ui build

ENV LIFT_MODE=live
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ANTHROPIC_API_KEY must be passed at runtime: docker run -e ANTHROPIC_API_KEY=... -p 3000:3000 lift-compass
CMD ["pnpm", "--filter", "@lift/ui", "start"]
