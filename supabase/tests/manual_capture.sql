begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000031', 'capture-owner@example.test'),
  ('00000000-0000-0000-0000-000000000032', 'capture-other@example.test');
insert into auth.identities (user_id, provider_id, provider, identity_data) values
  ('00000000-0000-0000-0000-000000000031', 'capture-owner', 'google', '{"sub":"capture-owner"}'),
  ('00000000-0000-0000-0000-000000000032', 'capture-other', 'google', '{"sub":"capture-other"}');
insert into public.access_allowlist (google_subject) values ('capture-owner'), ('capture-other');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select is(public.authorize_current_user(), true, 'owner activated');
select set_config('test.capture', '{"kind":"text","url":"","sourceId":"","rawText":"고구마 원문","servings":"","prepTime":"","cookTime":"","temperature":"","tips":"","ingredients":[{"name":"고구마","quantity":""}],"steps":[{"instruction":"얇게 펴요","time":"","temperature":""}],"evidence":[{"field":"예열","status":"missing","excerpt":null,"location":null}]}', true);
select public.save_capture('고구마 누룽지', '', '정리 본문', '', array['간식'], current_setting('test.capture')::jsonb);
select is((select raw_text from public.item_contents), '고구마 원문', 'raw text preserved separately');
select is((select body from public.item_contents), '정리 본문', 'editable body stored');
select is((select kind from public.sources), 'text', 'source type stored');
select is((select collection_method from public.sources), 'paste', 'collection method is honest');
select is((select quantity_text from public.ingredients), null::text, 'missing ingredient quantity remains null');
select is((select status from public.ingredients), 'missing', 'missing quantity explicitly marked');
select is((select temperature_text from public.recipe_details), null::text, 'no invented temperature');
select is((select status from public.source_evidence where field = '예열'), 'missing', 'preheating remains unknown');
select is((select count(*) from public.recipe_steps), 1::bigint, 'steps stored');
select set_config('test.owner_item', (select id::text from public.items), true);
select set_config('test.owner_source', (select id::text from public.sources), true);
select public.save_capture('고구마 수정', '', '본문 수정', '', array['다시 만들기'],
  jsonb_set(current_setting('test.capture')::jsonb, '{sourceId}', to_jsonb(current_setting('test.owner_source'))), current_setting('test.owner_item')::uuid);
select is((select count(*) from public.sources), 1::bigint, 'editing reuses source');
select is((select count(*) from public.ingredients), 1::bigint, 'editing replaces ingredients once');
select is((select count(*) from public.source_evidence), 1::bigint, 'editing replaces evidence once');
select throws_ok($$select public.save_capture('잘못된 수정', '', '', '', array[]::text[], jsonb_set(current_setting('test.capture')::jsonb, '{ingredients}', '[{"name":"","quantity":""}]'), current_setting('test.owner_item')::uuid)$$, '22023', null, 'invalid recipe rolls back entire update');
select is((select title from public.items), '고구마 수정', 'failed recipe edit preserves title');
select is((select body from public.item_contents), '본문 수정', 'failed recipe edit preserves body');
select throws_ok($$select public.save_capture('실패', '', '', '', array[]::text[], jsonb_set(current_setting('test.capture')::jsonb, '{url}', '"javascript:alert(1)"'))$$, '22023', null, 'unsafe URL rejected at DB boundary');
select throws_ok($$select public.save_capture('실패', '', '', '', array[]::text[], jsonb_set(current_setting('test.capture')::jsonb, '{kind}', '"unknown"'))$$, '22023', null, 'invalid source mode rejected');
select is((select count(*) from public.items), 1::bigint, 'failed captures create no partial item');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);
select is(public.authorize_current_user(), true, 'other owner activated');
select throws_ok($$select public.save_capture('탈취', '', '', '', array[]::text[], current_setting('test.capture')::jsonb, current_setting('test.owner_item')::uuid)$$, 'P0002', null, 'other owner cannot update capture');
select throws_ok($$select public.save_capture('탈취', '', '', '', array[]::text[], jsonb_set(current_setting('test.capture')::jsonb, '{sourceId}', to_jsonb(current_setting('test.owner_source'))))$$, 'P0002', null, 'other source cannot be reassigned');
select is((select count(*) from public.items), 0::bigint, 'cross-source failure rolls back item create');
select is((select count(*) from public.source_evidence), 0::bigint, 'other owner cannot read evidence');
set local role anon;
select throws_ok($$select public.save_capture('비로그인', '', '', '', array[]::text[], current_setting('test.capture')::jsonb)$$, '42501', null, 'anonymous capture denied');
reset role;
select * from finish();
rollback;
