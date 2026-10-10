begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000041', 'link-owner@example.test'),
  ('00000000-0000-0000-0000-000000000042', 'link-other@example.test');
insert into auth.identities (user_id, provider_id, provider, identity_data) values
  ('00000000-0000-0000-0000-000000000041', 'link-owner', 'google', '{"sub":"link-owner"}'),
  ('00000000-0000-0000-0000-000000000042', 'link-other', 'google', '{"sub":"link-other"}');
insert into public.access_allowlist (google_subject) values ('link-owner'), ('link-other');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true);
select is(public.authorize_current_user(), true, 'owner activated');
insert into public.extraction_requests (idempotency_key, canonical_url, lease_id) values
  ('10000000-0000-0000-0000-000000000041', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', '20000000-0000-0000-0000-000000000041');
select throws_ok($$insert into public.extraction_requests (idempotency_key, canonical_url, lease_id) values ('10000000-0000-0000-0000-000000000041', 'same', '20000000-0000-0000-0000-000000000041')$$, '23505', null, 'same owner key cannot claim twice');
select is((select count(*) from public.items), 0::bigint, 'extraction claims never create items');
select results_eq($$update public.extraction_requests set lease_id = '30000000-0000-0000-0000-000000000041' where started_at < now() - interval '30 seconds' returning idempotency_key$$, array[]::uuid[], 'fresh lease is not reclaimed');
update public.extraction_requests set started_at = now() - interval '60 seconds';
select results_eq($$update public.extraction_requests set lease_id = '30000000-0000-0000-0000-000000000041' where lease_id = '20000000-0000-0000-0000-000000000041' and result is null and started_at < now() - interval '30 seconds' returning idempotency_key$$, array['10000000-0000-0000-0000-000000000041'::uuid], 'stale lease is reclaimed atomically');
select results_eq($$update public.extraction_requests set result = '{"status":"success"}' where lease_id = '20000000-0000-0000-0000-000000000041' returning idempotency_key$$, array[]::uuid[], 'old worker cannot overwrite reclaimed result');
update public.extraction_requests set result = '{"status":"failed","code":"restricted"}';
select is((select count(*) from public.items), 0::bigint, 'failed collection creates no completed item');
select set_config('test.capture', '{"kind":"link","url":"https://www.youtube.com/watch?v=jNQXAC9IVRw","extractionKey":"10000000-0000-0000-0000-000000000041","rawText":"제목","ingredients":[],"steps":[],"evidence":[]}', true);
select throws_ok($$select public.save_capture('메타데이터', '', '', '', array[]::text[], current_setting('test.capture')::jsonb)$$, '22023', null, 'failed extraction cannot be saved as metadata success');
select is((select count(*) from public.items), 0::bigint, 'rejected metadata save leaves no partial item');
update public.extraction_requests set result = '{"status":"partial","title":"메타데이터","description":""}';
select public.save_capture('메타데이터', '', '', '', array[]::text[], current_setting('test.capture')::jsonb);
select is((select collection_method from public.sources), 'metadata', 'successful partial metadata has correct provenance');
select is((select status from public.source_evidence where field = '설명 메타데이터'), 'missing', 'partial description stays missing');
select throws_ok($$select public.save_capture('다른 링크', '', '', '', array[]::text[], jsonb_set(current_setting('test.capture')::jsonb, '{url}', '"https://www.instagram.com/p/other/"'))$$, '22023', null, 'metadata key cannot be reused for another source URL');
select throws_ok($$update public.extraction_requests set result = '{"unknown":true}'$$, '23514', null, 'invalid cached result status rejected');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000042', true);
select is(public.authorize_current_user(), true, 'other owner activated');
select is((select count(*) from public.extraction_requests), 0::bigint, 'other owner cannot read cache or source URL');
select results_eq($$update public.extraction_requests set result = '{"status":"failed"}' returning idempotency_key$$, array[]::uuid[], 'other owner cannot overwrite cache');
select throws_ok($$select public.save_capture('탈취', '', '', '', array[]::text[], current_setting('test.capture')::jsonb)$$, '22023', null, 'other owner cannot save using another extraction');
select lives_ok($$insert into public.extraction_requests (idempotency_key, canonical_url, lease_id) values ('10000000-0000-0000-0000-000000000041', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', '20000000-0000-0000-0000-000000000041')$$, 'idempotency key scoped per owner');
select throws_ok($$update public.extraction_requests set user_id = '00000000-0000-0000-0000-000000000041'$$, '42501', null, 'cache owner transfer denied');
set local role anon;
select throws_ok($$select * from public.extraction_requests$$, '42501', null, 'anonymous cache read denied');
reset role;
select * from finish();
rollback;
