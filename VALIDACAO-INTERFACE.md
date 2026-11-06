# Validação da interface — etapa 2

Código verificado: commit 2d49ff961012ed0fa8398f7c998696f16546bfc4.
SHA Git de web/app.js: 8d762399a530e41c3ad8c5bd41c3f0caf87cf3fc.
SHA Git de web/timer.js: 6ae6af064ed0b871909deb741ac4bf80a1e67d01.
As cópias usadas na execução conferem com esses hashes.

Comando: node tests/interface.test.cjs
Resultado: 16 testes de integração simulada aprovados.
Cobertura: iniciar/pausar, validação, aplicação preservando decorrido, confirmar/cancelar reinício, atalhos, concorrência na abertura de PiP, atualização do widget movido, foco, retorno ao fechar, API ausente e abertura negada.

O DOM, as janelas, o relógio, os intervalos e a confirmação foram simulados. Estes testes NÃO comprovam funcionamento gráfico, permissões reais, CSP, compatibilidade de navegador, Electron ou suspensão. O teste de retorno do widget simula pagehide; o comportamento real do navegador continua pendente.

## Problema do relógio confirmado em experimento separado
Após 5 segundos de contagem: 1195000 ms restantes.
Ao adiantar o relógio injetado em uma hora: -2405000 ms restantes.
Ao atrasar esse relógio em duas horas: 1200000 ms restantes.
Isso reproduz a limitação já documentada de Date.now(); não foi corrigida nesta etapa. O teste principal não trata essa limitação como comportamento aprovado.

## Prioridade seguinte
Projetar a fonte de tempo e a política de retomada, sem afirmar que o navegador distingue com certeza suspensão e mudança do relógio. Validar a solução em sistemas reais antes de uso crítico. A main e os arquivos originais não são alterados por este commit de testes.
