begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Google subject is provider-controlled; users cannot edit this access list.
create table public.access_allowlist (
  google_subject text primary key check (length(btrim(google_subject)) > 0),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'recipe' check (type = 'recipe'),
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null default '',
  favorite boolean not null default false,
  notes text not null default '',
  schema_version integer not null default 1 check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.item_contents (
  item_id uuid primary key,
  user_id uuid not null default auth.uid(),
  body text not null default '',
  raw_text text not null default '',
  foreign key (item_id, user_id) references public.items(id, user_id) on delete cascade
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid(),
  url text,
  platform text,
  author text,
  kind text not null check (kind in ('link', 'text', 'manual', 'attachment')),
  collection_method text not null check (collection_method in ('manual', 'paste', 'metadata', 'upload')),
  created_at timestamptz not null default now(),
  unique (id, item_id, user_id),
  foreign key (item_id, user_id) references public.items(id, user_id) on delete cascade
);

create table public.source_evidence (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  source_id uuid not null,
  user_id uuid not null default auth.uid(),
  field text not null check (length(btrim(field)) > 0),
  excerpt text,
  location text,
  status text not null check (status in ('confirmed', 'missing', 'failed', 'needs_review', 'conflicting')),
  unique (id, item_id, user_id),
  foreign key (source_id, item_id, user_id) references public.sources(id, item_id, user_id) on delete cascade
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid(),
  storage_path text not null unique,
  mime_type text not null check (length(btrim(mime_type)) > 0),
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/' || item_id::text || '/%'
    and length(split_part(storage_path, '/', 3)) > 0
    and array_length(string_to_array(storage_path, '/'), 1) = 3),
  foreign key (item_id, user_id) references public.items(id, user_id) on delete cascade
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index tags_user_name_idx on public.tags (user_id, lower(name));

create table public.item_tags (
  item_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid(),
  primary key (item_id, tag_id),
  foreign key (item_id, user_id) references public.items(id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('normalize', 'metadata')),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'partial', 'failed')),
  error_code text,
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (item_id, user_id) references public.items(id, user_id) on delete cascade
);

create table public.recipe_details (
  item_id uuid primary key,
  user_id uuid not null default auth.uid(),
  servings_text text,
  prep_time_text text,
  cook_time_text text,
  temperature_text text,
  tips text not null default '',
  unique (item_id, user_id),
  foreign key (item_id, user_id) references public.items(id, user_id) on delete cascade
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid(),
  name text not null check (length(btrim(name)) > 0),
  quantity_text text,
  position integer not null check (position > 0),
  status text not null default 'needs_review' check (status in ('confirmed', 'missing', 'failed', 'needs_review', 'conflicting')),
  evidence_id uuid,
  unique (item_id, position),
  foreign key (item_id, user_id) references public.recipe_details(item_id, user_id) on delete cascade,
  foreign key (evidence_id, item_id, user_id) references public.source_evidence(id, item_id, user_id) on delete set null (evidence_id)
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid(),
  position integer not null check (position > 0),
  instruction text not null check (length(btrim(instruction)) > 0),
  time_text text,
  temperature_text text,
  evidence_id uuid,
  unique (item_id, position),
  foreign key (item_id, user_id) references public.recipe_details(item_id, user_id) on delete cascade,
  foreign key (evidence_id, item_id, user_id) references public.source_evidence(id, item_id, user_id) on delete set null (evidence_id)
);

create index items_user_recent_idx on public.items (user_id, updated_at desc);
create index items_user_type_idx on public.items (user_id, type);
create index items_user_favorites_idx on public.items (user_id, updated_at desc) where favorite;
create index items_search_idx on public.items using gin (to_tsvector('simple', title || ' ' || summary || ' ' || notes));
create index item_contents_search_idx on public.item_contents using gin (to_tsvector('simple', body));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'item_contents', 'sources', 'source_evidence', 'attachments', 'tags', 'item_tags',
    'processing_jobs', 'recipe_details', 'ingredients', 'recipe_steps'
  ] loop
    execute format('create index %I on public.%I (user_id)', table_name || '_user_idx', table_name);
  end loop;
end;
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger processing_jobs_updated_at before update on public.processing_jobs
  for each row execute function public.set_updated_at();

-- Tables stay inaccessible even between the schema and policy migrations.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'access_allowlist', 'items', 'item_contents', 'sources', 'source_evidence',
    'attachments', 'tags', 'item_tags', 'processing_jobs', 'recipe_details', 'ingredients', 'recipe_steps'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
  end loop;
end;
$$;

commit;
