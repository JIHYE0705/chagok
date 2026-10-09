begin;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Profile status and the allowlist can only be provisioned by a trusted server/admin.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'items', 'item_contents', 'sources', 'source_evidence', 'attachments', 'tags',
    'item_tags', 'processing_jobs', 'recipe_details', 'ingredients', 'recipe_steps'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_owner', table_name
    );
  end loop;
end;
$$;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false);

-- Both owner and item must match; a user's folder alone does not establish ownership.
create policy attachments_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.items
      where items.id::text = (storage.foldername(name))[2] and items.user_id = (select auth.uid()))
  );
create policy attachments_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and array_length(storage.foldername(name), 1) = 2
    and length(storage.filename(name)) > 0
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.items
      where items.id::text = (storage.foldername(name))[2] and items.user_id = (select auth.uid()))
  );
create policy attachments_objects_update on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.items
      where items.id::text = (storage.foldername(name))[2] and items.user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'attachments'
    and array_length(storage.foldername(name), 1) = 2
    and length(storage.filename(name)) > 0
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.items
      where items.id::text = (storage.foldername(name))[2] and items.user_id = (select auth.uid()))
  );
create policy attachments_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.items
      where items.id::text = (storage.foldername(name))[2] and items.user_id = (select auth.uid()))
  );

commit;
