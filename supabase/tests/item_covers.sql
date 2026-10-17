begin;
set local storage.allow_delete_query = 'true';
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-000000000081','attachment-owner@example.test'),
 ('00000000-0000-0000-0000-000000000082','attachment-other@example.test');
insert into public.profiles (id,status) values
 ('00000000-0000-0000-0000-000000000081','active'),('00000000-0000-0000-0000-000000000082','active');
insert into public.access_allowlist (google_subject) values ('attachment-owner'),('attachment-other');
insert into auth.identities (user_id,provider_id,provider,identity_data) values
 ('00000000-0000-0000-0000-000000000081','attachment-owner','google','{"sub":"attachment-owner"}'),
 ('00000000-0000-0000-0000-000000000082','attachment-other','google','{"sub":"attachment-other"}');
insert into public.items (id,user_id,title) values
 ('10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000081','owner'),
 ('10000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000082','other');

insert into public.items (id,user_id,title) values ('10000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000081','another owned item');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','first.png','image/png',100);
select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000082','second.png','image/png',100);
select public.reserve_attachment('10000000-0000-0000-0000-000000000083','20000000-0000-0000-0000-000000000083','other-item.png','image/png',100);
select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000084','reference.pdf','application/pdf',100);
insert into storage.objects (bucket_id,name,metadata)
select 'attachments',storage_path,jsonb_build_object('size',100,'mimetype',mime_type) from public.attachments;
update public.attachments set status='ready';
select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000085','pending.png','image/png',100);
select lives_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081')$$,'owner chooses first cover');
select is((select id from public.attachments where is_cover),'20000000-0000-0000-0000-000000000081'::uuid,'chosen photo is cover');
select lives_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000082')$$,'owner changes cover');
select is((select count(*) from public.attachments where is_cover),1::bigint,'at most one cover');
select is((select id from public.attachments where is_cover),'20000000-0000-0000-0000-000000000082'::uuid,'new selection replaces old');
select throws_ok($$update public.attachments set is_cover=true where id='20000000-0000-0000-0000-000000000081'$$,'23505',null,'direct writes cannot create two covers');
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000083')$$,'22023',null,'same owner cannot choose another items photo');
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000084')$$,'22023',null,'PDF cannot become cover');
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000085')$$,'22023',null,'unfinished upload cannot become cover');
select throws_ok($$update public.attachments set is_cover=true where id='20000000-0000-0000-0000-000000000084'$$,'23514',null,'direct PDF selection rejected');
select is((select id from public.attachments where is_cover),'20000000-0000-0000-0000-000000000082'::uuid,'invalid changes preserve selection');
select lives_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081')$$,'owner clears cover');
select is((select count(*) from public.attachments where is_cover),0::bigint,'clear leaves attachments intact');
select is((select count(*) from public.attachments),5::bigint,'clear deletes no files');
select public.set_item_cover('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000082',true);
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081')$$,'42501',null,'other user cannot clear cover');
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000082','20000000-0000-0000-0000-000000000081')$$,'22023',null,'other user cannot select owners photo');
select is((select count(*) from public.attachments where is_cover),0::bigint,'cover metadata remains private');
reset role;
update public.profiles set status='disabled' where id='00000000-0000-0000-0000-000000000081';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081')$$,'42501',null,'disabled owner cannot clear cover');
select is((select count(*) from public.attachments where is_cover),0::bigint,'disabled owner cannot read cover');
reset role;
set local role anon;
select throws_ok($$select public.set_item_cover('10000000-0000-0000-0000-000000000081')$$,'42501',null,'anonymous cannot select cover');
reset role;
update public.profiles set status='active' where id='00000000-0000-0000-0000-000000000081';
set local role authenticated;
select lives_ok($$delete from storage.objects where bucket_id='attachments' and name like '%20000000-0000-0000-0000-000000000081.png'; delete from public.attachments where id='20000000-0000-0000-0000-000000000081'$$,'selected photo can be deleted after file cleanup');
select is((select count(*) from public.attachments where is_cover),0::bigint,'deletion leaves no dangling cover');
select * from finish();
rollback;
