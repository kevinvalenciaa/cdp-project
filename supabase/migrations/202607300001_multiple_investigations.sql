create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_memberships_user_idx on public.workspace_memberships(user_id, workspace_id);

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  objective text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists investigations_workspace_recent_idx
  on public.investigations(workspace_id, status, last_activity_at desc, id);

create table if not exists public.investigation_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  status text not null check (status in ('queued', 'running', 'complete', 'error', 'cancelled')),
  intent text not null check (intent in ('auto', 'answer', 'investigate', 'clarify')),
  client_message_id text,
  run_id uuid,
  citations jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (investigation_id, client_message_id)
);
create index if not exists investigation_messages_order_idx
  on public.investigation_messages(investigation_id, created_at, id);
create index if not exists investigation_messages_workspace_idx
  on public.investigation_messages(workspace_id, investigation_id);

create table if not exists public.investigation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  input_message_id uuid not null references public.investigation_messages(id),
  assistant_message_id uuid not null references public.investigation_messages(id),
  goal text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  context jsonb not null,
  result jsonb,
  cost_usd numeric,
  cancel_requested boolean not null default false,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
alter table public.investigation_messages
  drop constraint if exists investigation_messages_run_id_fkey;
alter table public.investigation_messages
  add constraint investigation_messages_run_id_fkey foreign key (run_id) references public.investigation_runs(id);
create index if not exists investigation_runs_thread_idx
  on public.investigation_runs(investigation_id, queued_at, id);
create index if not exists investigation_runs_workspace_idx
  on public.investigation_runs(workspace_id, investigation_id);
create unique index if not exists investigation_one_active_run_idx
  on public.investigation_runs(investigation_id)
  where status in ('queued', 'running');

create table if not exists public.investigation_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  message_id uuid references public.investigation_messages(id) on delete cascade,
  run_id uuid references public.investigation_runs(id) on delete cascade,
  event_dedupe_key text not null,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists investigation_events_run_dedupe_idx
  on public.investigation_events(run_id, event_dedupe_key)
  where run_id is not null;
create unique index if not exists investigation_events_system_dedupe_idx
  on public.investigation_events(investigation_id, event_dedupe_key)
  where run_id is null;
create index if not exists investigation_events_replay_idx
  on public.investigation_events(investigation_id, id);
create index if not exists investigation_events_workspace_idx
  on public.investigation_events(workspace_id, id desc);

create or replace function private.notify_investigation_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform pg_notify('investigation_events', new.investigation_id::text);
  return new;
end;
$$;
revoke all on function private.notify_investigation_event() from public;
drop trigger if exists investigation_events_notify on public.investigation_events;
create trigger investigation_events_notify
  after insert on public.investigation_events
  for each row execute function private.notify_investigation_event();

create table if not exists public.run_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.investigation_runs(id) on delete cascade,
  stage text not null,
  checkpoint_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, stage, checkpoint_key)
);
create index if not exists run_checkpoints_workspace_idx
  on public.run_checkpoints(workspace_id, run_id);

create table if not exists public.opportunity_occurrences (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  run_id uuid not null references public.investigation_runs(id) on delete cascade,
  opportunity_key text not null,
  accepted boolean not null,
  verdict text not null,
  impact_monthly numeric not null,
  verified_at timestamptz not null,
  valid_until timestamptz not null,
  opportunity jsonb not null,
  source_investigation_title text not null,
  superseded_by_occurrence_id text,
  unique (run_id, opportunity_key)
);
create index if not exists opportunity_occurrences_workspace_history_idx
  on public.opportunity_occurrences(workspace_id, opportunity_key, verified_at desc);
create index if not exists opportunity_occurrences_investigation_idx
  on public.opportunity_occurrences(investigation_id, opportunity_key, verified_at desc);
create index if not exists opportunity_occurrences_workspace_impact_idx
  on public.opportunity_occurrences(workspace_id, impact_monthly desc, opportunity_key);

create table if not exists public.workspace_opportunities (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_key text not null,
  current_occurrence_id text not null references public.opportunity_occurrences(id) on delete cascade,
  occurrence_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, opportunity_key)
);
create index if not exists workspace_opportunities_updated_idx
  on public.workspace_opportunities(workspace_id, updated_at desc);

create table if not exists public.workspace_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject text not null,
  subject_type text not null,
  claim text not null,
  verdict text not null,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric not null,
  source_run_id uuid references public.investigation_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  valid_until timestamptz not null,
  last_validated_at timestamptz not null default now(),
  unique (workspace_id, subject)
);
create index if not exists workspace_insights_valid_idx
  on public.workspace_insights(workspace_id, valid_until desc);

create table if not exists public.activations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id),
  run_id uuid not null references public.investigation_runs(id),
  occurrence_id text not null references public.opportunity_occurrences(id),
  opportunity_key text not null,
  created_by uuid not null references auth.users(id),
  status text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activations_workspace_idx
  on public.activations(workspace_id, created_at desc);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  message_id uuid references public.investigation_messages(id) on delete cascade,
  run_id uuid references public.investigation_runs(id) on delete cascade,
  queue text not null check (queue in ('assistant', 'engine')),
  status text not null check (status in ('queued', 'leased', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  worker_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_claim_idx
  on public.jobs(queue, status, available_at, lease_expires_at, created_at);
create index if not exists jobs_workspace_idx
  on public.jobs(workspace_id, investigation_id);

create table if not exists public.share_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  token_hash text not null unique,
  snapshot jsonb not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_snapshots_owner_idx
  on public.share_snapshots(workspace_id, investigation_id, created_at desc);
create index if not exists share_snapshots_creator_idx
  on public.share_snapshots(created_by, workspace_id, created_at desc);

create or replace function private.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = target_workspace
      and membership.user_id = (select auth.uid())
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function private.has_workspace_role(uuid, text[]) from public;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.investigations enable row level security;
alter table public.investigation_messages enable row level security;
alter table public.investigation_runs enable row level security;
alter table public.investigation_events enable row level security;
alter table public.run_checkpoints enable row level security;
alter table public.opportunity_occurrences enable row level security;
alter table public.workspace_opportunities enable row level security;
alter table public.workspace_insights enable row level security;
alter table public.activations enable row level security;
alter table public.jobs enable row level security;
alter table public.share_snapshots enable row level security;

create policy "profiles_self" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "workspace_members_read" on public.workspaces
  for select to authenticated
  using (private.has_workspace_role(id, array['owner','admin','member','viewer']));

create policy "memberships_workspace_read" on public.workspace_memberships
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));

create policy "memberships_admin_write" on public.workspace_memberships
  for all to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin']));

create policy "investigations_workspace_read" on public.investigations
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "investigations_member_write" on public.investigations
  for all to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin','member']));

create policy "messages_workspace_read" on public.investigation_messages
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "messages_member_write" on public.investigation_messages
  for all to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin','member']));

create policy "runs_workspace_read" on public.investigation_runs
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "events_workspace_read" on public.investigation_events
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "checkpoints_workspace_read" on public.run_checkpoints
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "occurrences_workspace_read" on public.opportunity_occurrences
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "current_opportunities_workspace_read" on public.workspace_opportunities
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "insights_workspace_read" on public.workspace_insights
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "activations_workspace_read" on public.activations
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','member','viewer']));
create policy "shares_owner_read" on public.share_snapshots
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_workspace_role(workspace_id, array['owner','admin'])
  );

-- Jobs and worker-side writes are service-role only. Public share access is
-- deliberately mediated by the application, which hashes the presented token.
revoke all on public.jobs from anon, authenticated;
revoke insert, update, delete on public.investigations from anon, authenticated;
revoke insert, update, delete on public.investigation_messages from anon, authenticated;
revoke insert, update, delete on public.investigation_runs from anon, authenticated;
revoke insert, update, delete on public.investigation_events from anon, authenticated;
revoke insert, update, delete on public.run_checkpoints from anon, authenticated;
revoke insert, update, delete on public.opportunity_occurrences from anon, authenticated;
revoke insert, update, delete on public.workspace_opportunities from anon, authenticated;
revoke insert, update, delete on public.workspace_insights from anon, authenticated;
revoke insert, update, delete on public.activations from anon, authenticated;
revoke insert, update, delete on public.share_snapshots from anon, authenticated;
