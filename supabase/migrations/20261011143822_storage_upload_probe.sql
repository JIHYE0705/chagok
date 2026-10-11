begin;

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
  -- Storage's rolled-back permission probe uses version '1' and incomplete metadata.
  if new.version = '1' then
    if new.metadata ? 'mimetype' and new.metadata->>'mimetype' <> attachment.mime_type then
      raise exception 'Upload metadata mismatch' using errcode = '22023';
    end if;
  elsif new.metadata is not null and ((new.metadata->>'size')::bigint is distinct from attachment.size_bytes
    or new.metadata->>'mimetype' is distinct from attachment.mime_type) then
    raise exception 'Upload metadata mismatch' using errcode = '22023';
  end if;
  return new;
end;
$$;

commit;
