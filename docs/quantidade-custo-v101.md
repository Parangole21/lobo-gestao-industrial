# Quantidade livre na apuração de custos — v101

A soma de peças boas, avarias e pendentes passa a definir a quantidade da apuração, independentemente da quantidade cadastrada na marca. Pode ser menor ou maior: por exemplo, uma marca cadastrada com 276 peças aceita apuração de 250 ou 300 peças.

A alteração se aplica ao salvamento principal e à edição do histórico. O cadastro de produção da marca não é ajustado automaticamente e a reposição em outra marca é lançada pelo usuário.

Quantidades automáticas:
- Corte, costura, serigrafia e bordado: quantidade da apuração (boas + avarias + pendentes).
- Tag, lacre, entretela, saquinhos e composição: peças boas.
- Quantidades informadas manualmente permanecem respeitadas, limitadas ao total correspondente da apuração.

Mantidas quantidades inteiras e não negativas e exigida pelo menos uma peça na apuração. Complementos preservam o total de peças da apuração existente, sem exigir igualdade com o cadastro da marca. Edições que apagariam peças já recuperadas continuam bloqueadas.

Custo unitário continua sendo custo consolidado / peças boas informadas. Taxa de avarias na tabela por marca passa a usar o total apurado, em conformidade com o indicador agregado.

Verificação: 80 testes automatizados passaram com o JavaScript completo e dependências simuladas, incluindo quantidade acima/abaixo do cadastro, serviços automáticos, edição de base e complementos, histórico, indicadores e sincronização entre instâncias. Não foram gravados registros reais para testar.
