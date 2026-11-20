'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Cron = require('../src/shared/cron');
const { sanitize, DEFAULTS } = require('../src/settings');

const base = { totalMs: 20 * 60000, accMs: 0, startedAt: null };

test('formata o tempo em MM:SS', () => {
  assert.equal(Cron.format(20 * 60000), '20:00');
  assert.equal(Cron.format(20 * 60000 - 1), '20:00'); // arredonda para cima
  assert.equal(Cron.format(59 * 1000 + 1), '01:00');
  assert.equal(Cron.format(0), '00:00');
  assert.equal(Cron.format(180 * 60000 - 34000), '179:26');
});

test('mostra o excesso com sinal de mais', () => {
  assert.equal(Cron.format(-1), '+00:00');
  assert.equal(Cron.format(-65000), '+01:05');
});

test('conta o tempo e respeita pausas', () => {
  let t = Cron.toggle(base, 1000);          // inicia em 1s
  assert.ok(Cron.isRunning(t));
  assert.equal(Cron.elapsed(t, 61000), 60000);
  t = Cron.toggle(t, 61000);                 // pausa com 60s
  assert.ok(!Cron.isRunning(t));
  assert.equal(Cron.elapsed(t, 999999), 60000);
  t = Cron.toggle(t, 100000);                // retoma
  assert.equal(Cron.elapsed(t, 110000), 70000);
  assert.equal(Cron.remaining(t, 110000), 20 * 60000 - 70000);
});

test('reiniciar zera o decorrido e mantém o total', () => {
  const t = Cron.reset({ totalMs: 300000, accMs: 5000, startedAt: 10 });
  assert.deepEqual(t, { totalMs: 300000, accMs: 0, startedAt: null });
});

test('ajuste de minutos nunca fica abaixo de 1 minuto', () => {
  assert.equal(Cron.adjust(base, 60000).totalMs, 21 * 60000);
  assert.equal(Cron.adjust({ ...base, totalMs: 60000 }, -60000).totalMs, 60000);
});

test('estados de cor', () => {
  const warn = 5 * 60000;
  assert.equal(Cron.stateOf(10 * 60000, warn), 'ok');
  assert.equal(Cron.stateOf(5 * 60000, warn), 'warn');
  assert.equal(Cron.stateOf(60000, warn), 'crit');
  assert.equal(Cron.stateOf(0, warn), 'crit');
  assert.equal(Cron.stateOf(-1, warn), 'over');
  assert.equal(Cron.stateOf(30000, warn, 0), 'warn');
});

test('configurações inválidas voltam ao padrão', () => {
  const s = sanitize({ totalMin: 'abc', position: 'meio', size: 'xl', opacity: 9, shortcuts: 0, warnMin: -3, critMin: -1, extra: 1 });
  assert.equal(s.totalMin, DEFAULTS.totalMin);
  assert.equal(s.position, DEFAULTS.position);
  assert.equal(s.size, DEFAULTS.size);
  assert.equal(s.opacity, 1);
  assert.equal(s.shortcuts, false);
  assert.equal(s.warnMin, 0);
  assert.ok(!('extra' in s));
});

test('posição personalizada é validada', () => {
  assert.deepEqual(sanitize({ customBounds: { x: 1.4, y: 2, width: 290, height: 120 } }).customBounds,
    { x: 1, y: 2, width: 290, height: 120 });
  assert.equal(sanitize({ customBounds: { x: 'a' } }).customBounds, null);
});

test('cores e fundos são validados', () => {
  assert.equal(sanitize({ color: 'azul' }).color, 'azul');
  assert.equal(sanitize({ color: '#A1b2C3' }).color, '#A1b2C3');
  assert.equal(sanitize({ color: 'red' }).color, DEFAULTS.color);
  assert.equal(sanitize({ color: '#fff' }).color, DEFAULTS.color);
  assert.equal(sanitize({ background: 'claro' }).background, 'claro');
  assert.equal(sanitize({ background: 'neon' }).background, DEFAULTS.background);
});

test('laranja maior que amarelo não apaga a fase amarela', () => {
  // amarelo aos 5 min, laranja configurado (por engano) aos 10 min: trata como 10/5
  assert.equal(Cron.stateOf(11 * 60000, 5 * 60000, 10 * 60000), 'ok');
  assert.equal(Cron.stateOf(8 * 60000, 5 * 60000, 10 * 60000), 'warn');
  assert.equal(Cron.stateOf(4 * 60000, 5 * 60000, 10 * 60000), 'crit');
  const s = sanitize({ warnMin: 5, critMin: 10 });
  assert.deepEqual([s.warnMin, s.critMin], [10, 5]);
  assert.equal(sanitize({ warnMin: 5, critMin: 2 }).critMin, 2);
});

test('ajustes de +1 minuto respeitam o teto de 600 minutos', () => {
  const t = { totalMs: 600 * 60000, accMs: 0, startedAt: null };
  assert.equal(Cron.adjust(t, 60000).totalMs, 600 * 60000);
  assert.equal(Cron.adjust({ ...t, totalMs: 599 * 60000 }, 60000).totalMs, 600 * 60000);
  assert.equal(Cron.adjust({ ...t, totalMs: 60000 }, -60000).totalMs, 60000);
});

test('avisos da prova disparam uma vez ao atravessar cada limite', () => {
  const list = [30, 15, 5];
  assert.deepEqual(Cron.crossed(30 * 60000 + 200, 30 * 60000 - 100, list), [30]);
  assert.deepEqual(Cron.crossed(30 * 60000 - 100, 30 * 60000 - 300, list), []); // já passou
  assert.deepEqual(Cron.crossed(16 * 60000, 4 * 60000, list), [15, 5]);        // salto (ex.: -10 min)
  assert.deepEqual(Cron.crossed(null, 1000, list), []);                         // sem leitura anterior
  assert.deepEqual(Cron.crossed(6 * 60000, 4 * 60000, []), []);
});

test('lista de avisos digitada pelo usuário é limpa e ordenada', () => {
  assert.deepEqual(Cron.parseMinutesList('10, 30;30 0 700 5'), [30, 10, 5]);
  assert.deepEqual(Cron.parseMinutesList(''), []);
  assert.deepEqual(Cron.parseMinutesList([1, '2', 2.5, -1]), [2, 1]);
});

test('título da prova é limitado e sem quebras de linha', () => {
  const s = sanitize({ examTitle: 'Prova\nfinal' + 'x'.repeat(200) });
  assert.ok(!s.examTitle.includes('\n'));
  assert.equal(s.examTitle.length, 120);
  assert.deepEqual(sanitize({}).examWarnings, [30, 15, 5]);
});
