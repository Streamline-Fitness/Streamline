create table public.user_training_documents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.user_training_documents enable row level security;

create policy "Users can read their own training document"
  on public.user_training_documents
  for select
  to authenticated
  using (auth.uid() = user_id);

create function public.save_training_document(p_document jsonb, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_version integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if jsonb_typeof(p_document) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_training_document';
  end if;

  if p_expected_version = 0 then
    insert into public.user_training_documents (user_id, document, version, updated_at)
    values (current_user_id, p_document, 1, now())
    on conflict (user_id) do nothing
    returning version into saved_version;
  else
    update public.user_training_documents
    set document = p_document,
        version = version + 1,
        updated_at = now()
    where user_id = current_user_id
      and version = p_expected_version
    returning version into saved_version;
  end if;

  if saved_version is null then
    raise exception using errcode = 'P0001', message = 'document_version_conflict';
  end if;

  return saved_version;
end;
$$;

revoke all on function public.save_training_document(jsonb, integer) from public, anon;
grant execute on function public.save_training_document(jsonb, integer) to authenticated;
grant select on public.user_training_documents to authenticated;
