begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', 'invited@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000012', 'outsider@example.test', '{"sub":"invited-google"}'),
  ('00000000-0000-0000-0000-000000000013', 'disabled@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000014', 'password@example.test', '{"provider":"google","sub":"invited-google"}');
insert into auth.identities (user_id, provider_id, provider, identity_data) values
  ('00000000-0000-0000-0000-000000000011', 'invited-google', 'google', '{"sub":"invited-google"}'),
  ('00000000-0000-0000-0000-000000000012', 'outsider-google', 'google', '{"sub":"outsider-google"}'),
  ('00000000-0000-0000-0000-000000000013', 'disabled-google', 'google', '{"sub":"disabled-google"}'),
  ('00000000-0000-0000-0000-000000000014', 'invited-google', 'email', '{"sub":"invited-google"}');
insert into public.access_allowlist (google_subject) values ('invited-google'), ('disabled-google');
insert into public.profiles (id, status) values
  ('00000000-0000-0000-0000-000000000013', 'disabled');
insert into public.items (id, user_id, title) values
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', 'invited fixture'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012', 'outsider fixture');
insert into storage.objects (bucket_id, name) values
  ('attachments', '00000000-0000-0000-0000-000000000011/10000000-0000-0000-0000-000000000011/fixture.png'),
  ('attachments', '00000000-0000-0000-0000-000000000012/10000000-0000-0000-0000-000000000012/fixture.png');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select is(public.has_app_access(), false, 'activation required before access');
select is(public.authorize_current_user(), true, 'invited Google identity activates own profile');
select is(public.authorize_current_user(), true, 'activation is idempotent');
select is((select status from public.profiles), 'active', 'profile is active');
select is((select count(*) from public.items), 1::bigint, 'invited owner can read');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select is(public.authorize_current_user(), false, 'editable sub cannot impersonate invite');
select is((select count(*) from public.items), 0::bigint, 'uninvited owner cannot read own data');
select is((select count(*) from storage.objects where bucket_id = 'attachments'), 0::bigint, 'uninvited storage hidden');
select throws_ok($$insert into public.items (title) values ('blocked')$$, '42501', null, 'uninvited insert denied');
select results_eq($$with changed as (update public.items set title = 'blocked' returning 1) select count(*) from changed$$,
  array[0::bigint], 'uninvited update denied');
select results_eq($$with changed as (delete from public.items returning 1) select count(*) from changed$$,
  array[0::bigint], 'uninvited delete denied');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('attachments',
  '00000000-0000-0000-0000-000000000012/10000000-0000-0000-0000-000000000012/new.png')$$,
  '42501', null, 'uninvited upload denied');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', true);
select is(public.authorize_current_user(), false, 'invite never reactivates disabled profile');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);
select is(public.authorize_current_user(), false, 'non-Google identity cannot use Google invite');

reset role;
delete from public.access_allowlist where google_subject = 'invited-google';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select is(public.has_app_access(), false, 'removal revokes an existing active session');
select is((select count(*) from public.items), 0::bigint, 'revoked session cannot read');
select is((select count(*) from storage.objects where bucket_id = 'attachments'), 0::bigint, 'revoked storage hidden');

reset role;
select is((select count(*) from pg_policies where schemaname = 'public' and policyname = 'require_app_access'
  and permissive = 'RESTRICTIVE' and cmd = 'ALL'), 12::bigint, 'all public user tables require app access');
select is((select count(*) from pg_policies where schemaname = 'storage' and policyname = 'attachments_require_app_access'
  and permissive = 'RESTRICTIVE' and cmd = 'ALL'), 1::bigint, 'storage requires app access');
set local role anon;
select throws_ok($$select public.authorize_current_user()$$, '42501', null, 'anonymous activation denied');
select throws_ok($$select public.has_app_access()$$, '42501', null, 'anonymous access RPC denied');

reset role;
select * from finish();
rollback;
