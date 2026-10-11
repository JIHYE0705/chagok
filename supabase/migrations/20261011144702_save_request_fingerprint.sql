begin;

alter table public.item_save_requests alter column input type text using encode(sha256(convert_to(input::text, 'UTF8')), 'hex');
alter table public.item_save_requests rename column input to input_hash;

create or replace function public.save_item_once(p_key uuid, p_input jsonb, p_item_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare previous public.item_save_requests; saved uuid; tags text[]; fingerprint text;
begin
  fingerprint := encode(sha256(convert_to(jsonb_build_object('itemId', p_item_id, 'input', p_input)::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_key::text, 0));
  select * into previous from public.item_save_requests where user_id = auth.uid() and request_key = p_key;
  if found then
    if previous.input_hash is distinct from fingerprint then
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
  insert into public.item_save_requests (request_key, input_hash, item_id)
    values (p_key, fingerprint, saved);
  return saved;
end;
$$;

create or replace function private.guard_attachment_object() returns trigger
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
  -- Size and MIME are verified against Storage metadata when marking the attachment ready.
  return new;
end;
$$;

commit;
