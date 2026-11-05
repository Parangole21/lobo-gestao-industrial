# Auditoria técnica — Lobo Gestão Industrial v98

Data: 05/11/2026. Escopo: código do sistema, cálculos e fluxos de recebimento, corte, marcas, custos, indicadores, importação e sincronização.

## Resultado

42 testes automatizados passaram em ambiente simulado. Em uma seleção de seis cenários executados também na v97, cinco falhas foram reproduzidas antes da correção. Não foram criados lançamentos reais para executar os testes.

Esta revisão não equivale a uma certificação integral do banco em produção. As limitações abaixo permanecem relevantes.

## Correções entregues

| Área | Problema confirmado ou identificado no código | Correção |
|---|---|---|
| Sincronização | Botão e mensagens de sucesso ocupavam o menu continuamente | Ocultos quando saudável; botão reaparece em erro e continua visível durante a tentativa, sumindo depois de um ciclo bem-sucedido |
| Custos | Salvar novamente criava outra apuração completa e o resumo somava revisões da mesma produção | Salvar atualiza o cartão atual; o total usa a última apuração e seus complementos |
| Custos e indicadores | Fontes diferentes para o total, com possível divergência entre telas | Ambos usam o mesmo cálculo consolidado |
| Custos | Subtotais sujeitos a resíduos de ponto flutuante | Arredondamento por item em centavos |
| Custos | Restauração de apuração anterior podia perder as peças recuperadas e os custos complementares | Reconstituição de itens, peças boas, avarias e pendências a partir da apuração e seus complementos |
| Custos | Prévia podia usar o total salvo após alteração dos campos | Prévia do rascunho separada do resumo consolidado salvo |
| Acabamentos | Quantidade de tag, lacre, entretela, saquinhos e composição podia exceder as peças boas | Limite pelas peças boas; serviços gerais continuam limitados à quantidade da marca |
| Compras | Editar podia apagar o status adicional de entrega e reduzir kg abaixo do recebido | Preservação dos campos existentes; bloqueio da redução inconsistente |
| Recebimentos | Exclusão verificava apenas o vínculo legado receipt-ID e podia ignorar o vínculo purchaseId | Bloqueio quando a compra vinculada já possui cortes ou marcas |
| Corte | Edição de um corte que consumiu todo o saldo podia perder a compra selecionada no select | Opções reconstruídas antes de selecionar a compra do corte |
| Indicadores | Entrega no último milissegundo do prazo era classificada diferentemente no percentual e na tabela | Comparação inclusiva uniforme |
| Importação | Backup v5 sem custos válidos alterava coleções em memória antes de rejeitar o arquivo | Validação desses custos antes de substituir as coleções |
| Sincronização | Consulta única podia omitir registros acima do limite de página do servidor | Leitura paginada, ordenada pela chave apropriada |
| Sincronização | Lotes eram enviados antes dos cortes de origem | Ordem: compras/recebimentos → cortes → marcas → custos |
| Exclusão de marcas | Algumas telas excluíam somente no navegador, causando conflito no próximo ciclo | Exclusão remota confirmada, com comparação de versão, backup e limpeza da base local correta |
| Exclusão de marcas | Outro PC mantinha lote excluído sem alterações locais | Aplica exclusão remota com backup; alterações locais e custos financeiros continuam protegidos |
| Interface | Texto prometia várias entregas embora a regra atual permita um recebimento por compra | Texto alinhado à regra existente, sem mudar essa regra |

## Exemplos numéricos validados

- 20 kg / 80 peças e 30 kg / 150 peças: 230 peças em 50 kg, rendimento ponderado de 4,6 peças/kg.
- Com 150 peças destinadas às marcas, restam 80 das 230 peças cortadas.
- Em 100 peças, 90 boas, 5 avarias e 5 pendentes: malha de R$ 1.000 + costura de R$ 3 × 100 + tag de R$ 0,50 × 90 = R$ 1.345.
- Recuperação das 5 pendentes com R$ 2,50 adicionais: 95 boas, 5 avarias, nenhuma pendente, custo de R$ 1.347,50.
- Editar esse complemento de 5 para 3 peças: 93 boas, 5 avarias, 2 pendentes e custo de R$ 1.346,50.
- Custo médio entre marcas calculado por custo total / total de peças boas, sem fazer média simples dos preços unitários.
- Quantidades negativas, fracionárias e acima dos saldos aplicáveis são rejeitadas nos cenários cobertos.
- Sem peças boas, custo unitário aparece como travessão, sem divisão por zero.

## Limitações e pendências

1. **Concorrência no banco — alta prioridade.** A comparação de updated_at protege alterações do mesmo registro. Porém não há garantia de transação única para dois cadastros distintos que consumam simultaneamente o mesmo saldo, nem reserva atômica da numeração MAL/LOT. A geração atual pode produzir o mesmo número em dois computadores que salvem ao mesmo tempo. A correção definitiva depende de restrições e funções transacionais no banco, ainda não inspecionadas/aplicadas nesta revisão.
2. **Gravação local antes da nuvem.** O sistema ainda usa armazenamento local e sincronização posterior. Uma mensagem de salvamento local não comprova gravação remota. Erros de sincronização permanecem visíveis, mas a arquitetura ainda não é exclusivamente remota.
3. **Permissões e recuperação externa.** Políticas RLS, permissões efetivas por usuário, esquema/constraints reais e restauração do backup externo não foram validados por acesso administrativo ao banco. Nenhuma política foi afrouxada.
4. **Importações.** Corrigida a alteração prematura quando os custos do v5 são inválidos. A importação ainda não possui um validador completo de todos os vínculos, quantidades e versões legadas.
5. **Natureza dos testes.** São testes do JavaScript real com DOM, rede e armazenamento simulados. Não substituem testes de concorrência real no Supabase ou validação visual completa nos navegadores dos dois PCs.
6. **Histórico de custos legado.** Cada apuração cobre a quantidade inteira da marca; as anteriores são tratadas como revisões. Os registros antigos não são apagados automaticamente e os resumos passam a usar a última revisão e seus complementos.

## Reproduzir os testes

Requer Node.js 22 ou superior, sem dependências adicionais:

```sh
node --test tests/audit.test.cjs
```

O workflow audit-checks executa esses testes em push e pull request. Não usa credenciais do banco nem grava dados em produção.
