# Critérios de liberação — Lobo Gestão Industrial

## Estado
- Ambiente publicado: **não alterado**.
- Cinco telas cloud-first: **implementadas em protótipo, sem homologação**.
- Sessão compartilhada por aba e renovação: **implementadas, sem teste de navegador real**.
- CRUD básico: **implementado**, mas as regras de negócio da aplicação original ainda não foram integralmente migradas.
- Exclusão: **implementada nos protótipos**, com confirmação e verificação de versão.
- RLS adicional para usuários inativos: **SQL preparado, NÃO executado**.
- Testes Node: **escritos, execução não comprovada**.

## Bloqueadores antes de trocar a aplicação atual
1. Executar `npm test` e corrigir falhas.
2. Testar o HTML servido por HTTPS (imports ES modules, sessão e permissões).
3. Validar o esquema real e políticas RLS com login admin e usuário inativo.
4. Verificar no banco o cadastro/edição/exclusão de cada entidade.
5. Reproduzir dois navegadores simultâneos: atualização, conflito e exclusão sem reaparecimento.
6. Migrar funcionalidades do sistema antigo: datas/status de compras, materiais de gola/punho/ribana, movimentações e prazos, custos parciais e pendências, avarias reprecificadas, limites de peças cortadas e histórico.
7. Revisar consistência de campos legados antes de usar registros existentes nos novos protótipos.
8. Publicar ambiente de homologação separado, testar, então decidir a substituição do sistema principal.
9. Somente após homologação, realizar backup verificável e limpeza autorizada dos registros de teste, sem excluir usuários ou perfis.

## Restrições
- Não executar SQL nem apagar dados de produção automaticamente.
- Não mesclar este branch com a versão publicada sem homologação.
- Não declarar pronto ou validado com base apenas na criação de arquivos.
