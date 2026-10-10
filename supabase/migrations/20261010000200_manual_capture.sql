begin;

create function public.save_capture(p_title text, p_summary text, p_body text, p_notes text, p_tags text[],
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
  return saved_id;
end;
$$;

revoke all on function public.save_capture(text,text,text,text,text[],jsonb,uuid) from public, anon;
grant execute on function public.save_capture(text,text,text,text,text[],jsonb,uuid) to authenticated;

commit;
