create table public.shared_workout_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_plan_id text not null check (length(source_plan_id) between 1 and 200),
  title text not null check (length(btrim(title)) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  plan_data jsonb not null
    check (jsonb_typeof(plan_data) = 'object' and octet_length(plan_data::text) <= 65536),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  unique (owner_id, source_plan_id)
);

create index shared_workout_plans_public_updated_idx
  on public.shared_workout_plans (updated_at desc)
  where is_public;

create index shared_workout_plans_search_idx
  on public.shared_workout_plans using gin (search_vector);

alter table public.shared_workout_plans enable row level security;

create policy "Owners can read their shared-plan settings"
  on public.shared_workout_plans
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can hide their shared plans"
  on public.shared_workout_plans
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on public.shared_workout_plans from public, anon, authenticated;
grant select (owner_id, source_plan_id, is_public) on public.shared_workout_plans to authenticated;
grant update (is_public) on public.shared_workout_plans to authenticated;

create function public.publish_shared_workout_plan(
  p_source_plan_id text,
  p_title text,
  p_description text,
  p_plan_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shared_plan_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_source_plan_id is null or length(p_source_plan_id) not between 1 and 200
    or p_title is null or length(btrim(p_title)) not between 1 and 100
    or p_description is null or length(p_description) > 500
    or jsonb_typeof(p_plan_data) is distinct from 'object'
    or jsonb_typeof(p_plan_data -> 'days') is distinct from 'array'
    or jsonb_typeof(p_plan_data -> 'blocks') is distinct from 'array'
    or jsonb_typeof(p_plan_data -> 'planExercises') is distinct from 'array'
    or jsonb_typeof(p_plan_data -> 'exercises') is distinct from 'array'
    or p_plan_data ->> 'name' is distinct from btrim(p_title)
    or p_plan_data ->> 'description' is distinct from p_description
    or octet_length(p_plan_data::text) > 65536 then
    raise exception using errcode = '22023', message = 'invalid_shared_workout_plan';
  end if;

  insert into public.shared_workout_plans (owner_id, source_plan_id, title, description, plan_data, is_public)
  values (current_user_id, p_source_plan_id, btrim(p_title), p_description, p_plan_data, true)
  on conflict (owner_id, source_plan_id) do update
    set title = excluded.title,
        description = excluded.description,
        plan_data = excluded.plan_data,
        is_public = true,
        updated_at = now()
  returning id into shared_plan_id;

  return shared_plan_id;
end;
$$;

create function public.search_shared_workout_plans(p_query text default null)
returns table (
  id uuid,
  title text,
  description text,
  plan_data jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  return query
  select shared.id, shared.title, shared.description, shared.plan_data, shared.updated_at
  from public.shared_workout_plans as shared
  where shared.is_public
    and shared.owner_id <> auth.uid()
    and (
      nullif(btrim(p_query), '') is null
      or shared.search_vector @@ plainto_tsquery('simple'::regconfig, left(coalesce(p_query, ''), 100))
    )
  order by shared.updated_at desc
  limit 50;
end;
$$;

revoke all on function public.publish_shared_workout_plan(text, text, text, jsonb) from public, anon;
revoke all on function public.search_shared_workout_plans(text) from public, anon;
grant execute on function public.publish_shared_workout_plan(text, text, text, jsonb) to authenticated;
grant execute on function public.search_shared_workout_plans(text) to authenticated;
