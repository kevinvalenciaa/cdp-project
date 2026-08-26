# Multiple investigations

The Opportunities product now has two layers:

- `/opportunities` is the workspace-wide current-truth inbox.
- `/investigations/[investigationId]` is a persistent conversation whose Results
  drawer is scoped to that investigation. (`/opportunities/[investigationId]` is
  a redirect kept for older links.)

Every verified candidate is stored as an immutable occurrence. A workspace projection points to the newest occurrence for each opportunity key, so a later rejection supersedes an older accepted result without erasing its history. Only a current, accepted, unexpired occurrence may be activated.

## Execution model

Submitting a message persists it and a job in one transaction. Assistant jobs classify the message as a grounded answer, a fresh investigation, or a clarification. Engine jobs run separately, emit append-only events, and promote results in one completion transaction. The browser consumes a replayable SSE stream; disconnecting never owns or cancels the computation.

Run both processes in production:

```bash
pnpm ui:build                             # builds @lift/protocol, @lift/sdk, @lift/core, then Next
pnpm ui:start                             # the production server, not next dev
pnpm ui:worker                            # in a second process
```

The web process may run on Vercel, while the live engine worker needs a long-lived Node container with the existing warehouse and Stats MCP dependencies.

The same production image can run both roles with
`docker compose -f docker-compose.worker.yml up --build`. The worker has no
public port; its 60-second leases make an interrupted job recoverable by another
worker after the lease expires. `/api/health` is the web readiness endpoint.

**`DATABASE_URL` is mandatory for the two-process topology.** Without it each
process falls back to its own local state file, so the web container enqueues
jobs the worker never sees and investigations sit `queued` forever with no error.
The compose file fails fast rather than letting that happen silently.

Where no separate worker exists - the Vercel demo, or a single `pnpm ui:dev` -
the web process drains the queues itself. The POST handlers kick the workers and
return, which is only sufficient while the process stays alive, so the
investigation event stream also re-pumps the queues every couple of seconds for
as long as a client is watching. That is what makes create -> run -> results
complete on a platform that suspends the instance as soon as a response flushes.

## Persistence modes

- Without `DATABASE_URL`, the app uses `runs/investigations-state.json`. This keeps the deterministic demo zero-configuration.
- With `DATABASE_URL`, it uses the normalized Supabase Postgres schema in `supabase/migrations`.
- Supabase Auth is enabled when the public Supabase URL and publishable key are configured. All exposed product tables have workspace-membership RLS.
- The cookie adapter is isolated in `src/server/supabase.ts`,
  `src/lib/supabase-browser.ts`, and middleware. `@supabase/ssr` is pinned to
  an exact version while its documented API remains beta.

For local Supabase:

```bash
supabase start
supabase db reset
psql "$DATABASE_URL" -f supabase/tests/multiple_investigations_rls.sql
```

`supabase/tests/integration_fixture.sql` provisions deterministic local users,
roles, and two isolated workspaces for repository and query-plan tests.

To migrate the old singleton `runs/app-state.json` after configuring the legacy owner variables:

```bash
pnpm ui:import-investigations
```

The importer is idempotent and creates one investigation named “Imported discovery run.”
Postgres imports require an explicit owner ID, owner email, and workspace ID;
`LEGACY_STATE_PATH` can point the verification workflow at a copied fixture.

## Shares

Share URLs contain a random 256-bit token. The database stores only its SHA-256 hash and an immutable, display-safe snapshot. Public pages are read-only, no-index, no-referrer, and no-store. Revocation therefore takes effect on the next request.
