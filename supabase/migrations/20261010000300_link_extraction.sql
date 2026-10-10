begin;

create table public.extraction_requests (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  canonical_url text not null check (length(canonical_url) between 1 and 2000),
  lease_id uuid not null,
  started_at timestamptz not null default now(),
  result jsonb,
  primary key (user_id, idempotency_key),
  check (result is null or (jsonb_typeof(result) = 'object' and length(result::text) <= 10000 and coalesce(result->>'status', '') in ('success', 'partial', 'failed')))
);
alter table public.extraction_requests enable row level security;
create policy extraction_requests_owner on public.extraction_requests for all to authenticated
  using (user_id = auth.uid() and public.has_app_access())
  with check (user_id = auth.uid() and public.has_app_access());
grant select, insert, update, delete on public.extraction_requests to authenticated;
revoke all on public.extraction_requests from anon;

alter table public.sources add column extraction_key uuid;
alter table public.sources add constraint sources_extraction_request_fkey
  foreign key (user_id, extraction_key) references public.extraction_requests(user_id, idempotency_key) on delete set null (extraction_key);

create or replace function public.save_capture(p_title text, p_summary text, p_body text, p_notes text, p_tags text[],
  p_capture jsonb, p_item_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid; saved_source_id uuid; entry jsonb; pos integer;
begin
  if jsonb_typeof(p_capture) is distinct from 'object'
    or coalesce(p_capture->>'kind', '') not in ('manual','text','link')
    or length(coalesce(p_capture->>'rawText', '')) > 50000
    or length(coalesce(p_capture->>'url', '')) > 2000
    or length(coalesce(p_capture->>'author', '')) > 200
    or length(coalesce(p_capture->>'tips', '')) > 10000
    or jsonb_typeof(p_capture->'ingredients') is distinct from 'array'
    or jsonb_typeof(p_capture->'steps') is distinct from 'array'
    or jsonb_typeof(p_capture->'evidence') is distinct from 'array' then
    raise exception 'Invalid capture input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_capture->'ingredients') > 100 or jsonb_array_length(p_capture->'steps') > 100
    or jsonb_array_length(p_capture->'evidence') > 1000
    or exists (select 1 from jsonb_each_text(p_capture) e where e.key in ('servings','prepTime','cookTime','temperature') and length(e.value) > 1000)
    or (coalesce(p_capture->>'url', '') <> '' and (p_capture->>'url' !~* '^https?://[^/[:space:]]+' or p_capture->>'url' ~* '^https?://[^/]*@'))
    or (p_capture->>'kind' = 'link' and coalesce(p_capture->>'url', '') = '') then
    raise exception 'Invalid capture input' using errcode = '22023';
  end if;
  if coalesce(p_capture->>'extractionKey', '') <> '' and (
    p_capture->>'kind' <> 'link' or not exists (
      select 1 from public.extraction_requests r where r.user_id = auth.uid()
        and r.idempotency_key = (p_capture->>'extractionKey')::uuid
        and r.canonical_url = p_capture->>'url' and r.result->>'status' in ('success', 'partial')
    )) then raise exception 'Extraction unavailable' using errcode = '22023'; end if;
  saved_id := public.save_item(p_title, p_summary, p_body, p_notes, p_tags, p_item_id);
  update public.item_contents set raw_text = coalesce(p_capture->>'rawText', '') where item_id = saved_id and user_id = auth.uid();
  if coalesce(p_capture->>'sourceId', '') <> '' then
    update public.sources set kind = p_capture->>'kind', url = nullif(p_capture->>'url', ''), author = nullif(p_capture->>'author', ''),
      collection_method = case when p_capture->>'kind' = 'manual' then 'manual' else 'paste' end
    where id = (p_capture->>'sourceId')::uuid and item_id = saved_id and user_id = auth.uid()
    returning id into saved_source_id;
    if saved_source_id is null then raise exception 'Source unavailable' using errcode = 'P0002'; end if;
  else
    insert into public.sources (item_id, kind, url, author, collection_method)
    values (saved_id, p_capture->>'kind', nullif(p_capture->>'url', ''), nullif(p_capture->>'author', ''),
      case when p_capture->>'kind' = 'manual' then 'manual' else 'paste' end) returning id into saved_source_id;
  end if;
  delete from public.source_evidence where source_id = saved_source_id and user_id = auth.uid();
  insert into public.source_evidence (item_id, source_id, field, excerpt, location, status)
  select saved_id, saved_source_id, e.field, e.excerpt, e.location, e.status
  from jsonb_to_recordset(p_capture->'evidence') as e(field text, excerpt text, location text, status text);
  insert into public.recipe_details (item_id, servings_text, prep_time_text, cook_time_text, temperature_text, tips)
  values (saved_id, nullif(p_capture->>'servings', ''), nullif(p_capture->>'prepTime', ''), nullif(p_capture->>'cookTime', ''), nullif(p_capture->>'temperature', ''), coalesce(p_capture->>'tips', ''))
  on conflict on constraint recipe_details_pkey do update set servings_text = excluded.servings_text, prep_time_text = excluded.prep_time_text,
    cook_time_text = excluded.cook_time_text, temperature_text = excluded.temperature_text, tips = excluded.tips;
  delete from public.ingredients where item_id = saved_id and user_id = auth.uid();
  delete from public.recipe_steps where item_id = saved_id and user_id = auth.uid();
  pos := 0;
  for entry in select value from jsonb_array_elements(p_capture->'ingredients') loop
    pos := pos + 1;
    if length(btrim(coalesce(entry->>'name', ''))) not between 1 and 500 or length(coalesce(entry->>'quantity', '')) > 500 then
      raise exception 'Invalid ingredient' using errcode = '22023';
    end if;
    insert into public.ingredients (item_id, name, quantity_text, position, status)
    values (saved_id, entry->>'name', nullif(entry->>'quantity', ''), pos, case when coalesce(entry->>'quantity', '') = '' then 'missing' else 'needs_review' end);
  end loop;
  pos := 0;
  for entry in select value from jsonb_array_elements(p_capture->'steps') loop
    pos := pos + 1;
    if length(btrim(coalesce(entry->>'instruction', ''))) not between 1 and 2000
      or length(coalesce(entry->>'time', '')) > 1000 or length(coalesce(entry->>'temperature', '')) > 1000 then
      raise exception 'Invalid step' using errcode = '22023';
    end if;
    insert into public.recipe_steps (item_id, instruction, time_text, temperature_text, position)
    values (saved_id, entry->>'instruction', nullif(entry->>'time', ''), nullif(entry->>'temperature', ''), pos);
  end loop;
  update public.sources set extraction_key = nullif(p_capture->>'extractionKey', '')::uuid,
    collection_method = case when coalesce(p_capture->>'extractionKey', '') <> '' then 'metadata'
      when p_capture->>'kind' = 'manual' then 'manual' else 'paste' end
  where id = saved_source_id and user_id = auth.uid();
  if coalesce(p_capture->>'extractionKey', '') <> '' then
    insert into public.source_evidence (item_id, source_id, field, status, location)
    select saved_id, saved_source_id, '설명 메타데이터',
      case when coalesce(r.result->>'description', '') = '' then 'missing' else 'needs_review' end, r.canonical_url
    from public.extraction_requests r where r.user_id = auth.uid() and r.idempotency_key = (p_capture->>'extractionKey')::uuid;
  end if;
  return saved_id;
end;
$$;

commit;
