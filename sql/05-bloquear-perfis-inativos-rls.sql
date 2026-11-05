-- REVISÃO OBRIGATÓRIA ANTES DE EXECUTAR EM PRODUÇÃO.
-- Proteção adicional: políticas permissivas existentes não podem liberar usuários inativos.
-- Não altera nem exclui dados. Pressupõe public.current_role() já existente e
-- RLS habilitada nas seis tabelas.
BEGIN;
DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY[
   'fabric_purchases','fabric_receipts','fabric_cuts',
   'production_lots','lot_costs','lot_movements'
 ]) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS lobo_active_profile_guard ON public.%I',t);
  EXECUTE format(
   'CREATE POLICY lobo_active_profile_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.current_role() IS NOT NULL) WITH CHECK (public.current_role() IS NOT NULL)',
   t
  );
 END LOOP;
END $$;
COMMIT;

-- Conferência após execução (não retorna dados industriais):
-- SELECT tablename,policyname,permissive,roles,cmd
-- FROM pg_policies WHERE schemaname='public'
-- AND policyname='lobo_active_profile_guard'
-- ORDER BY tablename;
