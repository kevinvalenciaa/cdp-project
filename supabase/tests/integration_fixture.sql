\set ON_ERROR_STOP on

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-one@example.com', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer-one@example.com', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-two@example.com', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-one@example.com', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.workspaces (id, name, slug)
values
  ('20000000-0000-4000-8000-000000000001', 'Integration One', 'integration-one'),
  ('20000000-0000-4000-8000-000000000002', 'Integration Two', 'integration-two')
on conflict (id) do nothing;

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'viewer'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'member'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'owner')
on conflict (workspace_id, user_id) do nothing;
