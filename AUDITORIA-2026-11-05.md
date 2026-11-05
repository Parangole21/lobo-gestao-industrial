# Auditoria técnica — 05/11/2026 (ambiente de testes)
**Escopo:** inspeção estática do `index.html` e do workflow `.github/workflows/supabase-backup.yml`. Nenhuma alteração na produção.
## Evidências verificadas
- Frontend usa Supabase Auth via `/auth/v1/token`, chave publishable e chamadas REST autenticadas com token.
- Não há string `service_role`, `sb_secret_` ou URI PostgreSQL no arquivo principal.
- Rotina de sincronização periódica (~30 s com página visível), verificações `updated_at` para algumas exclusões/atualizações e proteção de sessão.
- Workflow exporta roles, schema e dados, cifra com GPG AES256 e armazena artefato com retenção de 15 dias.
- Usuário confirmou execução GitHub Actions #8 bem-sucedida e artefato de 17,3 KB.
## Riscos e lacunas que exigem validação
1. **ALTO — Recuperação não comprovada.** Testar descriptografia e restauração em banco isolado; nunca restaurar sobre produção.
2. **ALTO — RLS não comprovada.** Políticas do Supabase não estão contidas no frontend; testar permissões para admin, usuário comum e não autenticado.
3. **ALTO — Dados locais por navegador.** Há dezenas de acessos ao `localStorage` com registros industriais. Avaliar isolamento entre usuários do mesmo navegador, limpeza de sessão e exposição local, sem apagar dados reais.
4. **MÉDIO — Concorrência.** Há checagens `updated_at` em certas rotinas, mas é preciso simular alterações simultâneas em todos os módulos e conferir resultados.
5. **MÉDIO — Retenção.** Quinze dias é janela curta; avaliar cópia adicional independente e política de recuperação.
6. **MÉDIO — Operação.** Testar compra → recebimento → corte → marca → custos → movimentações → entrega com dados fictícios.
7. **MÉDIO — Avisos Actions.** Node.js 20 e Ubuntu migrarão de versão; planejar atualização das actions após teste.
## Verificações automatizadas adicionadas
`node tests/audit-static.mjs` verifica invariantes básicas sem acessar banco ou credenciais. **Não substitui testes funcionais, RLS ou recuperação.**
## Estado
Ramo isolado de auditoria. Produção `main` não modificada. Nenhuma senha, dado de produção ou política Supabase alterados.
