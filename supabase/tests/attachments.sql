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
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
select lives_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','사진.png','image/png',100)$$,'owner reserves');
select lives_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','사진.png','image/png',100)$$,'retry reuses reservation');
select is((select count(*) from public.attachments),1::bigint,'one reservation');
select is((select storage_path from public.attachments),'00000000-0000-0000-0000-000000000081/10000000-0000-0000-0000-000000000081/20000000-0000-0000-0000-000000000081.png','server path uses UUIDs rather than file names');
select throws_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','other.png','image/png',100)$$,'22023',null,'key conflict rejected');
select throws_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000082',gen_random_uuid(),'image.png','image/png',100)$$,'42501',null,'other item denied');
select throws_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081',gen_random_uuid(),'script.svg','image/svg+xml',100)$$,'22023',null,'SVG rejected');
select throws_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081',gen_random_uuid(),'image.png','image/png',5242881)$$,'23514',null,'oversized file rejected in DB');
select throws_ok($$update public.attachments set status = 'ready'$$,'22023',null,'cannot claim completion without object');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('attachments','00000000-0000-0000-0000-000000000081/10000000-0000-0000-0000-000000000081/unreserved.png')$$,'42501',null,'unreserved direct upload denied');
select lives_ok($$insert into storage.objects(bucket_id,name,version,metadata) select 'attachments',storage_path,'1','{"size":null,"mimetype":null}' from public.attachments; delete from storage.objects where bucket_id='attachments'$$,'Storage permission probe accepts incomplete metadata');
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) select 'attachments',storage_path,'{"size":99,"mimetype":"image/png"}' from public.attachments$$,'bounded upload can reach finalization');
select throws_ok($$update public.attachments set status='ready'$$,'22023',null,'actual uploaded size must match before ready');
select lives_ok($$delete from storage.objects where bucket_id='attachments'$$,'invalid pending upload can be cleaned');
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) select 'attachments',storage_path,'{"size":100,"mimetype":"image/png"}' from public.attachments$$,'reserved upload succeeds');
select lives_ok($$update public.attachments set status = 'ready'$$,'matching uploaded metadata can be finalized');
select throws_ok($$delete from public.attachments$$,'23503',null,'metadata remains until object removed');
select throws_ok($$delete from public.items where id = '10000000-0000-0000-0000-000000000081'$$,'23503',null,'item remains until file cleanup');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000082',true);
select is((select count(*) from public.attachments),0::bigint,'other user cannot read metadata');
select is((select count(*) from storage.objects where bucket_id='attachments'),0::bigint,'other user cannot read file');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
select lives_ok($$delete from storage.objects where bucket_id='attachments'; delete from public.attachments$$,'owner cleans object then metadata');
reset role;
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('attachments','00000000-0000-0000-0000-000000000081/10000000-0000-0000-0000-000000000081/20000000-0000-0000-0000-000000000081.png','{"size":100,"mimetype":"image/png"}')$$,'42501',null,'late privileged signed upload after cancellation denied');
set local role authenticated;
select lives_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081',gen_random_uuid(),'image.png','image/png',100) from generate_series(1,10)$$,'ten reservations allowed');
select throws_ok($$select public.reserve_attachment('10000000-0000-0000-0000-000000000081',gen_random_uuid(),'image.png','image/png',100)$$,'22023',null,'eleventh reservation rejected');
select lives_ok($$delete from public.items where id = '10000000-0000-0000-0000-000000000081'$$,'pending reservations with no objects cascade safely');
select is((select count(*) from public.attachments),0::bigint,'no metadata orphan');
reset role;
select is((select public from storage.buckets where id='attachments'),false,'bucket stays private');
select is((select file_size_limit from storage.buckets where id='attachments'),5242880::bigint,'bucket enforces size');
select * from finish();
rollback;
