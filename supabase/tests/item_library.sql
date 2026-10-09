begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000021', 'library-owner@example.test'),
  ('00000000-0000-0000-0000-000000000022', 'library-other@example.test');
insert into auth.identities (user_id, provider_id, provider, identity_data) values
  ('00000000-0000-0000-0000-000000000021', 'library-owner', 'google', '{"sub":"library-owner"}'),
  ('00000000-0000-0000-0000-000000000022', 'library-other', 'google', '{"sub":"library-other"}');
insert into public.access_allowlist (google_subject) values ('library-owner'), ('library-other');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);
select is(public.authorize_current_user(), true, 'owner activated');
select is((select count(*) from public.search_items()), 0::bigint, 'new owner has empty library');
select public.save_item('고구마 누룽지', '바삭한 간식', '본문 전용 문구 %_,()', '다음에는 얇게', array['간식', '간식', 'SWEET', 'sweet']);
select is((select count(*) from public.items), 1::bigint, 'atomic create writes one item');
select is((select count(*) from public.item_contents), 1::bigint, 'atomic create writes body');
select is((select count(*) from public.tags), 2::bigint, 'case-insensitive tags deduplicated');
select is((select count(*) from public.item_tags), 2::bigint, 'duplicate links deduplicated');
select is((public.upsert_tag(' Sweet ')).name, 'SWEET', 'upsert reuses normalized existing tag');
select is((select count(*) from public.search_items('고구마')), 1::bigint, 'Korean title substring search');
select is((select count(*) from public.search_items('본문 전용')), 1::bigint, 'body search');
select is((select count(*) from public.search_items('바삭')), 1::bigint, 'summary search');
select is((select count(*) from public.search_items('얇게')), 1::bigint, 'notes search');
select is((select count(*) from public.search_items('sweet')), 1::bigint, 'tag search ignores case');
select is((select count(*) from public.search_items('%_,()')), 1::bigint, 'search punctuation is literal');
select is((select count(*) from public.search_items('%missing')), 0::bigint, 'percent never matches as wildcard');
select is((select count(*) from public.search_items(p_tag_id := (select id from public.tags where name = '간식'))), 1::bigint, 'tag filter');
select is((select count(*) from public.search_items(p_favorite := true)), 0::bigint, 'favorite filter starts empty');
select is(public.toggle_item_favorite((select id from public.items)), true, 'favorite toggles on');
select is((select count(*) from public.search_items(p_favorite := true)), 1::bigint, 'favorite filter includes toggled item');
select is(public.toggle_item_favorite((select id from public.items)), false, 'favorite toggles off');

insert into public.recipe_details (item_id, tips, servings_text) select id, '식힘망에 올려요', '인분 미기재' from public.items;
insert into public.ingredients (item_id, name, quantity_text, position) select id, '올리브유', null, 1 from public.items;
insert into public.recipe_steps (item_id, instruction, position) select id, '오븐에서 구워요', 1 from public.items;
select is((select count(*) from public.search_items('식힘망')), 1::bigint, 'recipe tips search');
select is((select count(*) from public.search_items('올리브유')), 1::bigint, 'ingredients search');
select is((select count(*) from public.search_items('오븐')), 1::bigint, 'recipe steps search');
update public.item_contents set raw_text = '보존해야 할 원문';
select public.save_item('고구마 개선', '', '수정된 본문', '', array['다시 만들기'], (select id from public.items));
select is((select title from public.items), '고구마 개선', 'update changes title');
select is((select body from public.item_contents), '수정된 본문', 'update changes body');
select is((select raw_text from public.item_contents), '보존해야 할 원문', 'update preserves source text');
select is((select count(*) from public.ingredients), 1::bigint, 'common edits preserve recipe details');
select is((select count(*) from public.search_items('보존해야')), 1::bigint, 'raw text search');
select is((select count(*) from public.item_tags), 1::bigint, 'update replaces tag links');
select throws_ok($$select public.save_item('실패한 저장', '', '', '', array[''])$$, '23514', null, 'invalid tag aborts entire create');
select is((select count(*) from public.items), 1::bigint, 'failed create leaves no partial item');
select throws_ok($$select public.save_item('실패한 수정', '', '', '', array[''], (select id from public.items))$$, '23514', null, 'invalid tag aborts entire update');
select is((select title from public.items), '고구마 개선', 'failed update preserves previous title');
select is((select count(*) from public.item_tags), 1::bigint, 'failed update preserves previous tags');
select throws_ok($$select public.save_item('', '', '', '', array[]::text[])$$, '22023', null, 'blank title rejected');
select throws_ok($$select public.save_item('제목', '', repeat('가',50001), '', array[]::text[])$$, '22023', null, 'oversized body rejected');

-- Save owner IDs for cross-user attempts without granting access to the rows.
select set_config('test.owner_item', (select id::text from public.items), true);
select set_config('test.owner_tag', (select tag_id::text from public.item_tags), true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
select is(public.authorize_current_user(), true, 'second user activated');
select is((select count(*) from public.search_items()), 0::bigint, 'other owner rows hidden from search');
select is((select count(*) from public.search_items('고구마')), 0::bigint, 'other owner text hidden');
select throws_ok($$select public.save_item('탈취', '', '', '', array[]::text[], current_setting('test.owner_item')::uuid)$$, 'P0002', null, 'cross-user update rejected');
select throws_ok($$select public.toggle_item_favorite(current_setting('test.owner_item')::uuid)$$, 'P0002', null, 'cross-user favorite rejected');
select results_eq($$with d as (delete from public.tags where id = current_setting('test.owner_tag')::uuid returning id) select count(*) from d$$, array[0::bigint], 'cross-user tag delete denied');
select public.save_item('다른 사용자의 간식', '', '', '', array['다시 만들기']);
select isnt((select id from public.tags), current_setting('test.owner_tag')::uuid, 'same name remains user-owned');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);
delete from public.tags where id = current_setting('test.owner_tag')::uuid;
select is((select count(*) from public.item_tags), 0::bigint, 'tag deletion removes links');
select is((select count(*) from public.items), 1::bigint, 'tag deletion preserves item');
insert into public.items (title, created_at) select '페이지 항목 ' || n, '2026-01-01'::timestamptz + n * interval '1 second' from generate_series(1, 30) n;
select is((select title from public.search_items() limit 1), '고구마 개선', 'recently saved first');
select is((select count(*) from public.search_items(p_page := 1)), 25::bigint, 'page includes one lookahead row');
select is((select count(*) from public.search_items(p_page := 2)), 7::bigint, 'next page continues after 24');
select is((select count(*) from public.search_items(p_page := -1)), 25::bigint, 'invalid page bounded');
delete from public.items where id = current_setting('test.owner_item')::uuid;
select is((select count(*) from public.item_contents), 0::bigint, 'item delete cascades body');
select is((select count(*) from public.recipe_details), 0::bigint, 'item delete cascades recipe');
select is((select count(*) from public.ingredients), 0::bigint, 'item delete cascades ingredients');
select is((select count(*) from public.recipe_steps), 0::bigint, 'item delete cascades steps');

reset role;
delete from public.access_allowlist where google_subject = 'library-owner';
set local role authenticated;
select is((select count(*) from public.search_items()), 0::bigint, 'revoked owner search denied');
select throws_ok($$select public.save_item('차단', '', '', '', array[]::text[])$$, '42501', null, 'revoked owner create denied');
set local role anon;
select throws_ok($$select public.search_items()$$, '42501', null, 'anonymous search denied');
select throws_ok($$select public.save_item('차단', '', '', '', array[]::text[])$$, '42501', null, 'anonymous save denied');
select throws_ok($$select public.upsert_tag('차단')$$, '42501', null, 'anonymous tag creation denied');
reset role;
select * from finish();
rollback;
