begin;

create table if not exists public.sewing_planning (
 id text primary key check (length(id) between 1 and 240),
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.sewing_planning enable row level security;
revoke all on public.sewing_planning from public, anon, authenticated;

-- Mantém exatamente as regras de acesso já usadas nas compras compartilhadas.
do $$
declare
 p record;
 role_names text;
 statement text;
 command_name text;
 privilege_name text;
begin
 if not exists(select 1 from pg_policy where polrelid='public.fabric_purchases'::regclass) then
  raise exception 'As políticas de acesso das compras não foram encontradas; migração interrompida.';
 end if;
 for privilege_name in select unnest(array['SELECT','INSERT','UPDATE','DELETE']) loop
  if has_table_privilege('authenticated','public.fabric_purchases',privilege_name) then
   execute format('grant %s on public.sewing_planning to authenticated',privilege_name);
  end if;
 end loop;
 for p in select * from pg_policy where polrelid='public.fabric_purchases'::regclass loop
  select string_agg(case when role_id=0 then 'public' else quote_ident(pg_get_userbyid(role_id)) end,',')
   into role_names from unnest(p.polroles) role_id;
  command_name=case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end;
  execute format('drop policy if exists %I on public.sewing_planning',p.polname);
  statement=format('create policy %I on public.sewing_planning as %s for %s to %s',p.polname,case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end,command_name,role_names);
  if p.polqual is not null then
   statement=statement||' using ('||regexp_replace(pg_get_expr(p.polqual,p.polrelid),'\mfabric_purchases\M','sewing_planning','g')||')';
  end if;
  if p.polwithcheck is not null then
   statement=statement||' with check ('||regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'\mfabric_purchases\M','sewing_planning','g')||')';
  end if;
  execute statement;
 end loop;
end;
$$;

create or replace function public.sewing_planning_revision()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 new.revision=old.revision+1;
 new.updated_at=clock_timestamp();
 return new;
end;
$$;
revoke all on function public.sewing_planning_revision() from public, anon, authenticated;
drop trigger if exists sewing_planning_revision on public.sewing_planning;
create trigger sewing_planning_revision before update on public.sewing_planning
for each row execute function public.sewing_planning_revision();

-- Verifica o caminho autenticado sem persistir registros de teste nem expor contas.
do $$
declare
 actor uuid;
 writable integer=0;
begin
 if has_table_privilege('anon','public.sewing_planning','SELECT') or has_table_privilege('anon','public.sewing_planning','INSERT') or has_table_privilege('anon','public.sewing_planning','UPDATE') then
  raise exception 'Planejamento não pode permitir acesso anônimo.';
 end if;
 for actor in select user_id from public.profiles where active=true loop
  perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
   insert into public.sewing_planning(id,data,updated_by) values('__migration_probe_20261124__','{"value":1}',actor);
   update public.sewing_planning set data='{"value":2}' where id='__migration_probe_20261124__' and revision=1;
   if (select revision from public.sewing_planning where id='__migration_probe_20261124__') is distinct from 2 then
    raise exception 'A confirmação de revisão do planejamento falhou.';
   end if;
   writable=writable+1;
   raise exception using errcode='Z0001',message='Rollback do registro temporário de verificação';
  exception
   when sqlstate 'Z0001' then null;
   when insufficient_privilege then null;
  end;
  execute 'reset role';
 end loop;
 if writable=0 then raise exception 'Nenhuma conta ativa conseguiu confirmar o salvamento do planejamento.'; end if;
 raise notice 'Planejamento: escrita autenticada e revisão verificadas para % conta(s); nenhum registro de teste foi persistido.',writable;
end;
$$;

notify pgrst, 'reload schema';
commit;
