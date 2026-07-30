\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-owner-one@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-viewer@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-owner-two@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rls-member@example.com', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email)
select id, email from auth.users where id::text like '30000000-%';

insert into public.workspaces (id, name, slug) values
  ('40000000-0000-4000-8000-000000000001', 'RLS Workspace One', 'rls-workspace-one'),
  ('40000000-0000-4000-8000-000000000002', 'RLS Workspace Two', 'rls-workspace-two');

insert into public.workspace_memberships (workspace_id, user_id, role) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'owner'),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'viewer'),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'member'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'owner');

insert into public.investigations (id, workspace_id, created_by, title, objective) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Workspace one investigation', 'Test workspace one isolation'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Workspace two investigation', 'Test workspace two isolation');

insert into public.share_snapshots (
  id, workspace_id, investigation_id, created_by, token_hash, snapshot
) values (
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000004',
  'rls-test-token-hash',
  '{"version":1,"investigationId":"50000000-0000-4000-8000-000000000001","title":"Safe snapshot","objective":"RLS test","asOf":"2026-07-30T00:00:00.000Z","scope":"proven","opportunities":[]}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'owner saw a cross-workspace workspace';
  end if;
  if (select count(*) from public.investigations) <> 1 then
    raise exception 'owner saw a cross-workspace investigation';
  end if;
  if (select count(*) from public.share_snapshots) <> 1 then
    raise exception 'owner could not administer the workspace share';
  end if;
  if has_table_privilege('authenticated', 'public.jobs', 'select') then
    raise exception 'authenticated role can read worker jobs';
  end if;
  if has_table_privilege('authenticated', 'public.investigations', 'insert') then
    raise exception 'authenticated role can bypass the investigation API';
  end if;
end
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.investigations) <> 1 then
    raise exception 'viewer cannot read its workspace investigation';
  end if;
  if (select count(*) from public.share_snapshots) <> 0 then
    raise exception 'viewer can enumerate share snapshots';
  end if;
end
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.investigations) <> 1 then
    raise exception 'member cannot read its workspace investigation';
  end if;
  if (select count(*) from public.share_snapshots) <> 1 then
    raise exception 'member cannot manage its own share snapshot';
  end if;
end
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.investigations) <> 1 then
    raise exception 'second owner workspace isolation failed';
  end if;
  if exists (
    select 1 from public.investigations
    where workspace_id = '40000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'second owner saw the first workspace';
  end if;
end
$$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if (select count(*) from public.share_snapshots) <> 0 then
    raise exception 'anonymous user can enumerate share snapshots';
  end if;
end
$$;
reset role;

rollback;
