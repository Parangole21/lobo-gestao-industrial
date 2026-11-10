begin;
create table if not exists public.sewing_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  unique (owner_id, id)
);
create unique index if not exists sewing_types_owner_name on public.sewing_types (owner_id, lower(btrim(name)));

create table if not exists public.sewing_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  type_id uuid not null,
  production_date date not null,
  quantity integer not null check (quantity > 0),
  note text not null default '' check (length(note) <= 500),
  revision integer not null default 1 check (revision > 0),
  foreign key (owner_id, type_id) references public.sewing_types(owner_id, id)
);
create index if not exists sewing_entries_owner_date on public.sewing_entries(owner_id, production_date);

create table if not exists public.sewing_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  month_start date not null check (extract(day from month_start) = 1),
  quantity integer not null check (quantity > 0),
  revision integer not null default 1 check (revision > 0),
  unique (owner_id, month_start)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['sewing_types', 'sewing_entries', 'sewing_goals'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists sewing_owner on public.%I', table_name);
    execute format('create policy sewing_owner on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', table_name);
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
