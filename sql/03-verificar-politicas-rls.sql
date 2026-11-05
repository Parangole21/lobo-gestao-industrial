-- Conferência de políticas RLS: consulta somente leitura
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
AND tablename IN ('fabric_purchases','fabric_receipts','fabric_cuts','production_lots','lot_costs','lot_movements')
ORDER BY tablename,policyname;
