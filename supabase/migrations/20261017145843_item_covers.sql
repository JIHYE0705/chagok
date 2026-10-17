begin;

alter table public.attachments add column is_cover boolean not null default false;
alter table public.attachments add constraint attachments_cover_image
  check (not is_cover or (status = 'ready' and mime_type in ('image/jpeg','image/png','image/webp')));
create unique index attachments_one_cover on public.attachments(item_id) where is_cover;

create function public.set_item_cover(p_item_id uuid, p_attachment_id uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.items where id = p_item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Item unavailable' using errcode = '42501'; end if;
  if p_attachment_id is not null and not exists (
    select 1 from public.attachments where id = p_attachment_id and item_id = p_item_id
      and user_id = auth.uid() and status = 'ready' and mime_type in ('image/jpeg','image/png','image/webp')
  ) then raise exception 'Cover unavailable' using errcode = '22023'; end if;
  update public.attachments set is_cover = false where item_id = p_item_id and user_id = auth.uid() and is_cover;
  if p_attachment_id is not null then
    update public.attachments set is_cover = true where id = p_attachment_id and item_id = p_item_id and user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.set_item_cover(uuid,uuid) from public, anon;
grant execute on function public.set_item_cover(uuid,uuid) to authenticated;

commit;
