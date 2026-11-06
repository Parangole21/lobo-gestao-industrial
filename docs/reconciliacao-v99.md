# Correção de reconciliação — v99

Data: 06/11/2026.

## Problema reproduzido

Um computador mantinha uma compra MAL-0001 já sincronizada anteriormente. Essa compra havia sido excluída no banco e outra compra, com outro ID, utilizava MAL-0001. A v98 verificava a numeração antes de reconhecer a exclusão remota, interrompendo o ciclo com “Numeração divergente em uma compra já sincronizada”.

O mesmo bloqueio podia ocorrer quando a compra era renumerada na nuvem e seu número antigo passava a outra compra.

## Correção

- Primeiro identifica exclusões remotas e conflitos de edição.
- Só então verifica a numeração sobre a visão reconciliada das compras.
- Cópias antigas sem alterações são arquivadas em backup local antes da retirada e substituição pela lista recebida da nuvem.
- Uma exclusão remota não é tratada como cadastro novo e não reenvia a compra antiga.
- Alterações locais em compras, recebimentos, cortes e marcas continuam protegidas e bloqueiam a reconciliação automática.
- Números realmente duplicados em cadastros novos continuam exigindo escolha explícita.
- A base de comparação é normalizada sem depender da ordem das chaves JSON. Base corrompida interrompe o ciclo sem transformar registros em novos cadastros.

## Verificação

57 testes passaram com o JavaScript completo e rede/DOM/armazenamento simulados. Quatro dos primeiros cinco cenários de regressão falharam na v98; os cinco passaram após a correção. Nenhum registro real foi gravado no banco para executar os testes.

Incluídos: reutilização de MAL-0001, renumeração recebida da nuvem, repetição idempotente do ciclo, backup de cópias antigas, proteção de edições pendentes e vínculos novos, falha na gravação do backup, falha de rede e base inválida.

Após publicar, o computador afetado precisa carregar a v99 e entrar novamente. O resultado nos dados reais desse computador ainda depende dessa verificação.

As limitações de concorrência/transações de banco descritas na auditoria v98 permanecem.
