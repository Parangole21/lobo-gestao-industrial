# Migração: login único, múltiplos computadores, Supabase como fonte única

Estado: **planejamento técnico; NÃO PUBLICAR**. Produção `main` continua com sincronização bidirecional legada.

## Diagnóstico confirmado no index.html v93
- Compras (`parents`), recebimentos (`records`), lotes (`lots`), cortes (`cuts`) e custos usam armazenamento local do navegador.
- `cloudSyncMaterials`, `cloudSyncLots`, `cloudSyncCuts` e `cloudSyncCosts` reconciliam cópias locais e remotas; `setInterval` chama essas rotinas a cada 30 segundos.
- Login também dispara reconciliação. Um DELETE direto no Supabase não apaga cópias locais; elas podem ser reenviadas.
- `persistLots()` grava localStorage e dispara sync assíncrono, sem confirmação transacional de persistência.
- `syncReceiptParents()` gera compras sintéticas de recebimentos sem purchaseId; garantir que essas linhas não contaminem cadastro de compras.

## Arquitetura aprovada
- Supabase/PostgREST é a **única fonte autoritativa** de dados de negócio.
- Mesmo login pode abrir múltiplos computadores; cadastro secundário permanece no Auth/profiles, sem ser excluído.
- Nenhum registro local pode ser enviado automaticamente na inicialização ou ao abrir abas.
- Leituras consultam a nuvem; cache local apenas derivado, nunca fonte para recriar registros.
- Escritas (incluir/editar/excluir) usam request autenticada e aguardam confirmação; não mostrar sucesso antes de receber resposta.
- Edição e exclusão condicionais a updated_at/versão, com aviso de conflito.
- Numeração de compras gerada de modo atômico no banco; evitar dois MAL-0001.
- Todas as seis tabelas operacionais: fabric_purchases, fabric_receipts, fabric_cuts, production_lots, lot_movements, lot_costs.
- Se a conexão cair, bloquear escritas ou enfileirar somente com idempotência explícita; nunca sincronizar snapshot local automaticamente.

## Ordem de implementação
1. Mapear schemas, políticas RLS e todas as funções de gravação/remoção do index.html.
2. Criar camada de acesso remoto com erros visíveis e controle de versão.
3. Migrar compras e recebimentos para operações remotas; remover reconciliação legada para esses módulos.
4. Migrar lotes, cortes, custos e movimentações, preservando integridade referencial.
5. Revisar fluxo de login único e atualização de telas; testes em dois navegadores.
6. Com abas fechadas, zerar dados operacionais por SQL aprovado, preservando profiles/auth; limpar armazenamento específico do site em todos os computadores.
7. Publicar somente após testes: inclusão, edição, exclusão, atualização em segundo PC, concorrência, falha de rede, reinício do navegador, ausência de ressurgimento.

## Critérios de aceite
- Compra criada no PC A aparece no B após atualização.
- Compra excluída no A nunca reaparece no B, mesmo com abas antigas.
- Recebimento aparece tanto em seu histórico quanto nas consultas correspondentes.
- Sem duplicação MAL-0001 em inclusão simultânea.
- Não há botão que alegue sucesso sem confirmação remota.
- Nenhuma exclusão de usuários, senhas ou perfis.

## Riscos
- Simplesmente desativar `setInterval` NÃO resolve: deixa dados exclusivamente locais, com risco de perda.
- Usar o mesmo login simultaneamente reduz rastreabilidade por funcionário; pode ser acrescentado campo operador depois.
- Limpeza SQL sem corrigir mecanismo de sync pode ressuscitar registros; nunca executar antes de disponibilizar a nova versão.
