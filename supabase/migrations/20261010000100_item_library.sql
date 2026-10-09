begin;

-- Invoker functions keep the existing ownership and app-access RLS in force.
create function public.upsert_tag(p_name text) returns public.tags
language plpgsql security invoker set search_path = '' as $$
declare result public.tags;
begin
  insert into public.tags (user_id, name) values (auth.uid(), btrim(p_name))
  on conflict (user_id, lower(name)) do update set name = public.tags.name
  returning * into result;
  return result;
end;
$$;

create function public.save_item(p_title text, p_summary text, p_body text, p_notes text, p_tags text[], p_item_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid; tag public.tags; tag_name text;
begin
  if length(btrim(p_title)) not between 1 and 200
    or length(p_summary) > 1000 or length(p_body) > 50000 or length(p_notes) > 10000
    or cardinality(p_tags) > 20 then
    raise exception 'Invalid item input' using errcode = '22023';
  end if;
  if p_item_id is null then
    insert into public.items (user_id, title, summary, notes)
    values (auth.uid(), btrim(p_title), p_summary, p_notes) returning id into saved_id;
  else
    update public.items set title = btrim(p_title), summary = p_summary, notes = p_notes
    where id = p_item_id and user_id = auth.uid() returning id into saved_id;
    if saved_id is null then raise exception 'Item unavailable' using errcode = 'P0002'; end if;
  end if;
  insert into public.item_contents (item_id, user_id, body) values (saved_id, auth.uid(), p_body)
  on conflict on constraint item_contents_pkey do update set body = excluded.body;
  delete from public.item_tags where item_tags.item_id = saved_id and user_id = auth.uid();
  foreach tag_name in array p_tags loop
    tag := public.upsert_tag(tag_name);
    insert into public.item_tags (item_id, tag_id, user_id) values (saved_id, tag.id, auth.uid()) on conflict do nothing;
  end loop;
  return saved_id;
end;
$$;

create function public.toggle_item_favorite(p_item_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare result boolean;
begin
  update public.items set favorite = not favorite where id = p_item_id and user_id = auth.uid()
  returning favorite into result;
  if result is null then raise exception 'Item unavailable' using errcode = 'P0002'; end if;
  return result;
end;
$$;

-- shortcut: substring search scans the owner's rows; add trigram indexes when large libraries make searches slow.
create function public.search_items(p_query text default '', p_tag_id uuid default null,
  p_favorite boolean default false, p_page integer default 1)
returns setof public.items language sql stable security invoker set search_path = '' as $$
  select i.* from public.items i
  where i.user_id = auth.uid()
    and (not p_favorite or i.favorite)
    and (p_tag_id is null or exists (select 1 from public.item_tags it
      where it.item_id = i.id and it.user_id = auth.uid() and it.tag_id = p_tag_id))
    and (p_query = ''
      or strpos(lower(i.title || ' ' || i.summary || ' ' || i.notes), lower(p_query)) > 0
      or exists (select 1 from public.item_contents c where c.item_id = i.id and c.user_id = auth.uid()
        and strpos(lower(c.body || ' ' || c.raw_text), lower(p_query)) > 0)
      or exists (select 1 from public.item_tags it join public.tags t on t.id = it.tag_id and t.user_id = it.user_id
        where it.item_id = i.id and it.user_id = auth.uid() and strpos(lower(t.name), lower(p_query)) > 0)
      or exists (select 1 from public.recipe_details r where r.item_id = i.id and r.user_id = auth.uid()
        and strpos(lower(concat_ws(' ', r.servings_text, r.prep_time_text, r.cook_time_text, r.temperature_text, r.tips)), lower(p_query)) > 0)
      or exists (select 1 from public.ingredients g where g.item_id = i.id and g.user_id = auth.uid()
        and strpos(lower(concat_ws(' ', g.name, g.quantity_text)), lower(p_query)) > 0)
      or exists (select 1 from public.recipe_steps s where s.item_id = i.id and s.user_id = auth.uid()
        and strpos(lower(concat_ws(' ', s.instruction, s.time_text, s.temperature_text)), lower(p_query)) > 0))
  order by i.created_at desc, i.id desc
  limit 25 offset (least(greatest(p_page, 1), 100000) - 1) * 24;
$$;

revoke all on function public.upsert_tag(text), public.save_item(text,text,text,text,text[],uuid),
  public.toggle_item_favorite(uuid), public.search_items(text,uuid,boolean,integer) from public, anon;
grant execute on function public.upsert_tag(text), public.save_item(text,text,text,text,text[],uuid),
  public.toggle_item_favorite(uuid), public.search_items(text,uuid,boolean,integer) to authenticated;

commit;
