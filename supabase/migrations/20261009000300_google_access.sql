begin;

-- Read Google identities from Auth, never from editable user_metadata or email.
create function public.has_app_access()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.identities i
    join public.access_allowlist a on a.google_subject = i.provider_id
    join public.profiles p on p.id = i.user_id
    where i.user_id = (select auth.uid()) and i.provider = 'google' and p.status = 'active'
  );
$$;

create function public.authorize_current_user()
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.identities i
    join public.access_allowlist a on a.google_subject = i.provider_id
    where i.user_id = (select auth.uid()) and i.provider = 'google'
  ) then
    return false;
  end if;
  insert into public.profiles (id, status) values ((select auth.uid()), 'active')
    on conflict (id) do update set status = 'active' where profiles.status = 'pending';
  return public.has_app_access();
end;
$$;

revoke all on function public.has_app_access() from public, anon;
revoke all on function public.authorize_current_user() from public, anon;
grant execute on function public.has_app_access(), public.authorize_current_user() to authenticated;

-- Restrictive policies add the invite boundary to existing ownership policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'items', 'item_contents', 'sources', 'source_evidence', 'attachments',
    'tags', 'item_tags', 'processing_jobs', 'recipe_details', 'ingredients', 'recipe_steps'
  ] loop
    execute format(
      'create policy require_app_access on public.%I as restrictive for all to authenticated using ((select public.has_app_access())) with check ((select public.has_app_access()))',
      table_name
    );
  end loop;
end;
$$;

create policy attachments_require_app_access on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'attachments' or (select public.has_app_access()))
  with check (bucket_id <> 'attachments' or (select public.has_app_access()));

commit;
