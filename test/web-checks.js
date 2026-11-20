'use strict';

/*
 * Verificações da versão para navegador (docs/index.html).
 * Este código roda DENTRO da página e devolve a lista de falhas.
 * É usado por test/web-limits.js (no CI, com o Electron como navegador).
 */
module.exports = String.raw`(async () => {
  const $ = (id) => document.getElementById(id);
  const fails = [];
  const set = (id, v) => { $(id).value = String(v); $('bSet').click(); };
  const key = (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const check = (name, got, want) => { if (String(got) !== String(want)) fails.push(name + ': esperado ' + want + ', veio ' + got); };

  // Duração digitada acima do limite
  set('inMin', 5000);
  check('digitar 5000 min (campo)', $('inMin').value, 600);
  check('digitar 5000 min (relógio)', $('big').textContent, '600:00');

  // +1 no limite, por botão e por tecla
  $('bPlus').click(); key('+');
  check('+1 em 600 min', $('inMin').value, 600);

  // -1 no mínimo, por botão e por tecla
  set('inMin', 1);
  $('bMinus').click(); key('-');
  check('-1 em 1 min', $('inMin').value, 1);
  check('-1 em 1 min (relógio)', $('big').textContent, '01:00');

  // Alerta amarelo acima do limite
  set('inWarn', 999);
  check('alerta 999 min', $('inWarn').value, 120);

  // Uso normal continua igual
  set('inMin', 30);
  $('bPlus').click();
  check('30 min +1', $('inMin').value, 31);
  check('30 min +1 (relógio)', $('big').textContent, '31:00');

  // Valor inválido não quebra o relógio
  set('inMin', 'abc');
  check('valor inválido mantém o anterior', $('big').textContent, '31:00');

  return fails;
})()`;
