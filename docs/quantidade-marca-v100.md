# Quantidade de marca acima do saldo — v100

A quantidade da marca pode ultrapassar as peças restantes do corte ao cadastrar ou editar uma marca sem apuração de custos. O formulário informa o excedente, sem confirmação adicional nem bloqueio pelo saldo.

Exemplo: 100 peças cortadas, 80 já destinadas, nova marca de 30 peças. Salva 30 e avisa sobre 10 peças acima do saldo. A quantidade de peças cortadas permanece 100; o saldo aritmético passa a -10, representando programação além do corte existente.

Cortes adicionais podem cobrir a diferença em etapas. Continua bloqueada a edição que reduz um corte e piora o saldo abaixo da quantidade já destinada.

Continuam exigidos lote de origem e quantidade inteira positiva. A proteção contra alteração de quantidade quando já existem custos permanece, para preservar a apuração.

Verificação: 66 testes automatizados passaram. Cobrem cadastro acima do saldo, saldo zero, edição sem duplicação, aviso informativo, valores inválidos, proteção de custos, cortes parciais e sincronização da quantidade entre duas instâncias simuladas.

Os testes usam dados fictícios e não lançam registros reais no banco.
