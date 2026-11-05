-- Diagnóstico SOMENTE LEITURA. Execute no Supabase SQL Editor.
-- Não apaga registros, usuários, políticas ou tabelas.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('fabric_purchases','fabric_receipts','production_lots','fabric_cuts','lot_movements','lot_costs','profiles')
order by table_name,ordinal_position;

select tc.table_name,tc.constraint_name,tc.constraint_type,
       kcu.column_name,ccu.table_name as referenced_table,ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema
where tc.table_schema='public'
  and tc.table_name in ('fabric_purchases','fabric_receipts','production_lots','fabric_cuts','lot_movements','lot_costs')
order by tc.table_name,tc.constraint_name;

select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_policies where schemaname='public'
and tablename in ('fabric_purchases','fabric_receipts','production_lots','fabric_cuts','lot_movements','lot_costs')
order by tablename,policyname;
