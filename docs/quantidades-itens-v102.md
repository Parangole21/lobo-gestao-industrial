# Quantidades dos itens de custo livres — v102

As quantidades aplicadas a cada item podem ultrapassar as peças boas, o total da apuração, a quantidade da marca e, nos complementos, as peças recuperadas. Não há confirmação adicional nem bloqueio por essas comparações.

A mudança vale para salvar/editar o custo principal, editar o histórico e lançar/editar complementos.

Exemplo: 187 peças boas com 276 peças atendidas em costura, tag ou outro item. Cada subtotal usa valor do item × quantidade atendida; custo unitário consolidado continua usando as peças boas informadas.

Quantidades automáticas continuam disponíveis. Ao editar manualmente uma quantidade, ela é preservada nas atualizações dos demais campos.

Continuam exigidos valores numéricos finitos e não negativos e quantidades inteiras não negativas. Permanecem as regras de classificação/recuperação de peças e a proteção de conflitos entre computadores; esta alteração retira os limites comparativos das quantidades de serviços e acabamentos.

Verificação: 88 testes automatizados passaram com dependências simuladas. Cobrem os quatro caminhos de salvamento, quantidades acima dos totais e rejeição de valores inválidos. Nenhum dado real foi lançado para testar.
