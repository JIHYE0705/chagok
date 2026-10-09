begin;
-- Only synthetic metadata is mutated; every test is rolled back.
set local storage.allow_delete_query = 'true';
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'other@example.test');
insert into public.profiles (id, display_name) select id, 'fixture' from auth.users
  where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
insert into public.access_allowlist (google_subject) values ('test-google-subject');
insert into public.items (id, user_id, title) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Owner recipe'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Other recipe');
insert into public.item_contents (item_id, user_id, body, raw_text)
  select id, user_id, 'fixture body', 'fixture source' from public.items
  where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
insert into public.sources (id, item_id, user_id, kind, collection_method) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'text', 'paste'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'text', 'paste');
insert into public.source_evidence (id, item_id, source_id, user_id, field, status) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'quantity', 'missing'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'quantity', 'missing');
insert into public.attachments (item_id, user_id, storage_path, mime_type, size_bytes)
  select id, user_id, user_id::text || '/' || id::text || '/fixture.png', 'image/png', 100 from public.items
  where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
insert into public.tags (id, user_id, name) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Fixture'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Fixture');
insert into public.item_tags (item_id, tag_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
insert into public.processing_jobs (item_id, user_id, kind, idempotency_key)
  select id, user_id, 'normalize', 'fixture' from public.items
  where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
insert into public.recipe_details (item_id, user_id)
  select id, user_id from public.items
  where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
insert into public.ingredients (item_id, user_id, name, position)
  select item_id, user_id, '고구마', 1 from public.recipe_details
  where item_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
insert into public.recipe_steps (item_id, user_id, instruction, position)
  select item_id, user_id, '원문대로 조리', 1 from public.recipe_details
  where item_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
insert into storage.objects (bucket_id, name)
  select 'attachments', storage_path from public.attachments
  where user_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Exercise the same four operations on every user data table, under real DB roles.
create function pg_temp.check_owner_table(table_name text) returns setof text
language plpgsql as $$
declare
  visible_count bigint;
  changed_count bigint;
  deleted_count bigint;
  inserted_count bigint;
  payload jsonb;
begin
  execute format('select count(*) from public.%I', table_name) into visible_count;
  return next is(visible_count, 1::bigint, table_name || ': owner sees only own row');
  execute format('select count(*) from public.%I where user_id = %L', table_name,
    '00000000-0000-0000-0000-000000000002') into visible_count;
  return next is(visible_count, 0::bigint, table_name || ': other row hidden');
  execute format('update public.%I set user_id = user_id where user_id = %L', table_name,
    '00000000-0000-0000-0000-000000000002');
  get diagnostics changed_count = row_count;
  return next is(changed_count, 0::bigint, table_name || ': other update denied');
  execute format('delete from public.%I where user_id = %L', table_name,
    '00000000-0000-0000-0000-000000000002');
  get diagnostics changed_count = row_count;
  return next is(changed_count, 0::bigint, table_name || ': other delete denied');
  return next throws_ok(format('update public.%I set user_id = %L', table_name,
    '00000000-0000-0000-0000-000000000002'), '42501', null, table_name || ': ownership transfer denied');
  execute format('select to_jsonb(t) from public.%I t limit 1', table_name) into payload;
  payload = payload || '{"user_id":"00000000-0000-0000-0000-000000000002"}'::jsonb;
  return next throws_ok(format('insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, %2$L::jsonb)',
    table_name, payload), '42501', null, table_name || ': other insert denied');
  execute format('update public.%I set user_id = user_id', table_name);
  get diagnostics changed_count = row_count;
  return next is(changed_count, 1::bigint, table_name || ': owner update allowed');
  execute format('select to_jsonb(t) from public.%I t limit 1', table_name) into payload;
  -- Roll back the owner mutation so cascades cannot remove another table's fixture.
  begin
    execute format('delete from public.%I', table_name);
    get diagnostics deleted_count = row_count;
    execute format('insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, %2$L::jsonb)', table_name, payload);
    get diagnostics inserted_count = row_count;
    raise exception using errcode = 'PT001', message = 'restore fixture';
  exception when sqlstate 'PT001' then
    null;
  end;
  return next is(deleted_count, 1::bigint, table_name || ': owner delete allowed');
  return next is(inserted_count, 1::bigint, table_name || ': owner insert allowed');
end;
$$;

create function pg_temp.check_anonymous_table(table_name text) returns setof text
language plpgsql as $$
begin
  return next throws_ok(format('select * from public.%I', table_name), '42501', null, table_name || ': anon select denied');
  return next throws_ok(format('insert into public.%I default values', table_name), '42501', null, table_name || ': anon insert denied');
  return next throws_ok(format('update public.%I set user_id = user_id', table_name), '42501', null, table_name || ': anon update denied');
  return next throws_ok(format('delete from public.%I', table_name), '42501', null, table_name || ': anon delete denied');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select checks.* from unnest(array[
  'items', 'item_contents', 'sources', 'source_evidence', 'attachments', 'tags',
  'item_tags', 'processing_jobs', 'recipe_details', 'ingredients', 'recipe_steps'
]) as tables(table_name) cross join lateral pg_temp.check_owner_table(table_name) checks;

select is((select count(*) from public.profiles), 1::bigint, 'profile owner only');
select lives_ok($$update public.profiles set display_name = 'new name'$$, 'owner can update display name');
select throws_ok($$update public.profiles set status = 'active'$$, '42501', null, 'user cannot promote profile');
select throws_ok($$insert into public.profiles (id) values (auth.uid())$$, '42501', null, 'user cannot provision profile');
select throws_ok($$delete from public.profiles$$, '42501', null, 'user cannot delete profile');
select throws_ok($$select * from public.access_allowlist$$, '42501', null, 'allowlist cannot be read by users');
select throws_ok($$insert into public.access_allowlist values ('injected', now())$$, '42501', null, 'allowlist insert denied');
select throws_ok($$update public.access_allowlist set google_subject = 'injected'$$, '42501', null, 'allowlist update denied');
select throws_ok($$delete from public.access_allowlist$$, '42501', null, 'allowlist delete denied');

select throws_ok($$update public.item_contents set item_id = '10000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot attach own content to another user item');
select throws_ok($$update public.sources set item_id = '10000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot attach own source to another user item');
select throws_ok($$update public.attachments set item_id = '10000000-0000-0000-0000-000000000002',
  storage_path = user_id::text || '/10000000-0000-0000-0000-000000000002/fixture.png'$$,
  '23503', null, 'cannot attach own metadata to another user item');
select throws_ok($$update public.processing_jobs set item_id = '10000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot attach own job to another user item');
select throws_ok($$update public.recipe_details set item_id = '10000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot attach own recipe details to another user item');
select throws_ok($$update public.recipe_steps set item_id = '10000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot attach own steps to another user recipe');
select throws_ok($$update public.item_tags set tag_id = '40000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot attach another user tag');
select throws_ok($$update public.source_evidence set source_id = '20000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot cite another user source');
select throws_ok($$update public.ingredients set evidence_id = '30000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'cannot cite another user evidence');
select throws_ok($$insert into public.tags (name) values ('fixture')$$, '23505', null, 'tag names deduplicate ignoring case');
select throws_ok($$insert into public.processing_jobs (item_id, kind, idempotency_key)
  values ('10000000-0000-0000-0000-000000000001', 'normalize', 'fixture')$$,
  '23505', null, 'duplicate save key rejected');

select is((select count(*) from storage.objects where bucket_id = 'attachments'), 1::bigint, 'owner reads own storage object');
select lives_ok($$insert into storage.objects (bucket_id, name)
  values ('attachments', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/new.png')$$,
  'owner uploads to own item');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('attachments', '00000000-0000-0000-0000-000000000002/10000000-0000-0000-0000-000000000002/new.png')$$,
  '42501', null, 'upload to another user folder denied');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('attachments', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002/new.png')$$,
  '42501', null, 'upload to another user item denied');
select throws_ok($$update storage.objects set name = '00000000-0000-0000-0000-000000000002/10000000-0000-0000-0000-000000000002/stolen.png'$$,
  '42501', null, 'moving object to another user denied');
select results_eq($$with changed as (update storage.objects set metadata = '{}' where name like '00000000-0000-0000-0000-000000000002/%' returning 1) select count(*) from changed$$,
  array[0::bigint], 'other storage update denied');
select results_eq($$with changed as (delete from storage.objects where name like '00000000-0000-0000-0000-000000000002/%' returning 1) select count(*) from changed$$,
  array[0::bigint], 'other storage delete denied');
select lives_ok($$update storage.objects set metadata = '{}' where name like '00000000-0000-0000-0000-000000000001/%'$$, 'owner storage update allowed');
select lives_ok($$delete from storage.objects where name like '00000000-0000-0000-0000-000000000001/%'$$, 'owner storage delete allowed');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select checks.* from unnest(array[
  'items', 'item_contents', 'sources', 'source_evidence', 'attachments', 'tags',
  'item_tags', 'processing_jobs', 'recipe_details', 'ingredients', 'recipe_steps'
]) as tables(table_name) cross join lateral pg_temp.check_anonymous_table(table_name) checks;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon profile denied');
select throws_ok($$insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'anon profile insert denied');
select throws_ok($$update public.profiles set display_name = 'injected'$$, '42501', null, 'anon profile update denied');
select throws_ok($$delete from public.profiles$$, '42501', null, 'anon profile delete denied');
select throws_ok($$select * from public.access_allowlist$$, '42501', null, 'anon allowlist denied');
select throws_ok($$insert into public.access_allowlist values ('injected', now())$$, '42501', null, 'anon allowlist insert denied');
select throws_ok($$update public.access_allowlist set google_subject = 'injected'$$, '42501', null, 'anon allowlist update denied');
select throws_ok($$delete from public.access_allowlist$$, '42501', null, 'anon allowlist delete denied');
select is((select count(*) from storage.objects where bucket_id = 'attachments'), 0::bigint, 'anon storage read denied');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('attachments', 'anonymous.png')$$,
  '42501', null, 'anon storage upload denied');
select results_eq($$with changed as (update storage.objects set metadata = '{}' where bucket_id = 'attachments' returning 1) select count(*) from changed$$,
  array[0::bigint], 'anon storage update denied');
select results_eq($$with changed as (delete from storage.objects where bucket_id = 'attachments' returning 1) select count(*) from changed$$,
  array[0::bigint], 'anon storage delete denied');

reset role;
select is((select public from storage.buckets where id = 'attachments'), false, 'attachments bucket is private');
select is((select quantity_text from public.ingredients where user_id = '00000000-0000-0000-0000-000000000001'),
  null::text, 'unknown quantity remains null');
select * from finish();
rollback;
