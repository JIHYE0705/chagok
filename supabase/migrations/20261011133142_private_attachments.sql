begin;

update storage.buckets set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'attachments';
alter table public.attachments add column file_name text not null default '첨부 파일';
alter table public.attachments add constraint attachments_upload_limits
  check (size_bytes between 1 and 5242880 and mime_type in ('image/jpeg','image/png','image/webp','application/pdf')
    and length(btrim(file_name)) between 1 and 200);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Serialize reservations, late signed uploads and deletion on the same item row.
create function private.guard_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target public.attachments; object_metadata jsonb;
begin
  if tg_op = 'DELETE' then target := old; else target := new; end if;
  perform 1 from public.items where id = target.item_id and user_id = target.user_id for update;
  if not found and tg_op <> 'DELETE' then raise exception 'Item unavailable' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and (new.id, new.user_id, new.item_id, new.storage_path, new.mime_type, new.size_bytes, new.file_name)
    is distinct from (old.id, old.user_id, old.item_id, old.storage_path, old.mime_type, old.size_bytes, old.file_name) then
    raise exception 'Attachment identity is immutable' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.attachments where item_id = new.item_id) >= 10 then
    raise exception 'Attachment limit reached' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' and exists (select 1 from storage.objects where bucket_id = 'attachments' and name = old.storage_path) then
    raise exception 'Remove the Storage file first' using errcode = '23503';
  end if;
  if tg_op <> 'DELETE' and new.status = 'ready' then
    select metadata into object_metadata from storage.objects where bucket_id = 'attachments' and name = new.storage_path;
    if object_metadata is null or (object_metadata->>'size')::bigint is distinct from new.size_bytes
      or object_metadata->>'mimetype' is distinct from new.mime_type then
      raise exception 'Upload incomplete' using errcode = '22023';
    end if;
  end if;
  return target;
end;
$$;
create trigger attachments_upload_guard before insert or update or delete on public.attachments
  for each row execute function private.guard_attachment();

-- Signed uploads run as Storage's privileged role, so RLS alone cannot revoke them.
create function private.guard_attachment_object() returns trigger
language plpgsql security definer set search_path = '' as $$
declare attachment public.attachments;
begin
  if new.bucket_id <> 'attachments' then return new; end if;
  select a.* into attachment from public.attachments a where a.storage_path = new.name;
  if not found then raise exception 'Upload reservation unavailable' using errcode = '42501'; end if;
  perform 1 from public.items where id = attachment.item_id and user_id = attachment.user_id for update;
  -- Re-read after acquiring the lock: cancellation may have committed while we waited.
  select a.* into attachment from public.attachments a where a.storage_path = new.name;
  if not found or attachment.status <> 'pending' or not exists (
    select 1 from public.profiles p join auth.identities i on i.user_id = p.id
      join public.access_allowlist a on a.google_subject = i.provider_id
    where p.id = attachment.user_id and p.status = 'active' and i.provider = 'google'
  ) then raise exception 'Upload reservation unavailable' using errcode = '42501'; end if;
  -- Storage probes INSERT with null metadata while issuing a signed URL.
  if new.metadata is not null and ((new.metadata->>'size')::bigint is distinct from attachment.size_bytes
    or new.metadata->>'mimetype' is distinct from attachment.mime_type) then
    raise exception 'Upload metadata mismatch' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger chagok_attachment_object_guard before insert or update on storage.objects
  for each row execute function private.guard_attachment_object();

create function private.guard_item_attachment_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'attachments'
      and name like old.user_id::text || '/' || old.id::text || '/%') then
    raise exception 'Remove attachments first' using errcode = '23503';
  end if;
  return old;
end;
$$;
create trigger items_attachment_delete_guard before delete on public.items
  for each row execute function private.guard_item_attachment_delete();
revoke all on function private.guard_attachment(), private.guard_attachment_object(), private.guard_item_attachment_delete() from public, anon, authenticated;

create function public.reserve_attachment(p_item_id uuid, p_key uuid, p_name text, p_mime text, p_size bigint)
returns public.attachments language plpgsql security invoker set search_path = '' as $$
declare result public.attachments; extension text;
begin
  perform 1 from public.items where id = p_item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Item unavailable' using errcode = '42501'; end if;
  select * into result from public.attachments where id = p_key and user_id = auth.uid();
  if found then
    if (result.item_id, result.file_name, result.mime_type, result.size_bytes) is distinct from (p_item_id, p_name, p_mime, p_size) then
      raise exception 'Upload key conflict' using errcode = '22023';
    end if;
    return result;
  end if;
  extension := case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' end;
  if extension is null then raise exception 'Unsupported type' using errcode = '22023'; end if;
  insert into public.attachments (id, item_id, user_id, storage_path, file_name, mime_type, size_bytes)
    values (p_key, p_item_id, auth.uid(), auth.uid()::text || '/' || p_item_id::text || '/' || p_key::text || '.' || extension, p_name, p_mime, p_size)
    returning * into result;
  return result;
end;
$$;
revoke all on function public.reserve_attachment(uuid,uuid,text,text,bigint) from public, anon;
grant execute on function public.reserve_attachment(uuid,uuid,text,text,bigint) to authenticated;

create table public.item_save_requests (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_key uuid not null,
  input jsonb not null,
  item_id uuid references public.items(id) on delete set null,
  primary key (user_id, request_key)
);
alter table public.item_save_requests enable row level security;
create policy item_save_requests_owner on public.item_save_requests for all to authenticated
  using (user_id = auth.uid() and public.has_app_access()) with check (user_id = auth.uid() and public.has_app_access());
grant select, insert on public.item_save_requests to authenticated;
revoke all on public.item_save_requests from anon;

create function public.save_item_once(p_key uuid, p_input jsonb, p_item_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare previous public.item_save_requests; saved uuid; tags text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_key::text, 0));
  select * into previous from public.item_save_requests where user_id = auth.uid() and request_key = p_key;
  if found then
    if previous.input is distinct from jsonb_build_object('itemId', p_item_id, 'input', p_input) then
      raise exception 'Save key conflict' using errcode = '22023';
    end if;
    if previous.item_id is null then raise exception 'Saved item was deleted' using errcode = 'P0002'; end if;
    return previous.item_id;
  end if;
  select array_agg(value) into tags from jsonb_array_elements_text(p_input->'tags');
  tags := coalesce(tags, array[]::text[]);
  if p_input->'capture' is not null and p_input->'capture' <> 'null'::jsonb then
    saved := public.save_capture(p_input->>'title', p_input->>'summary', p_input->>'body', p_input->>'notes', tags, p_input->'capture', p_item_id);
  else
    saved := public.save_item(p_input->>'title', p_input->>'summary', p_input->>'body', p_input->>'notes', tags, p_item_id);
  end if;
  insert into public.item_save_requests (request_key, input, item_id)
    values (p_key, jsonb_build_object('itemId', p_item_id, 'input', p_input), saved);
  return saved;
end;
$$;
revoke all on function public.save_item_once(uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_item_once(uuid,jsonb,uuid) to authenticated;

commit;
