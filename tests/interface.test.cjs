const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Timer = require('../web/timer.js');
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
function environment(mode = 'supported') {
  let now = 1000000, confirm = true, interval, requests = 0;
  const events = {}, pipEvents = {};
  const elements = new Map('count widget status toggle details minutes warning message theme home reset apply plus minus pip'.split(' ').map(id => [id, {
    id, textContent: '', value: id === 'minutes' ? '20' : id === 'warning' ? '5' : '', dataset: {},
    append(child) { child.parent = id; }
  }]));
  elements.get('widget').parent = 'home';
  const target = {closed: false, focuses: 0, focus() {this.focuses++;},
    document: {title: '', documentElement: {}, createElement: () => ({}), head: {append() {}},
      body: {append(child) {child.parent = 'pip';}}, addEventListener() {}},
    setInterval: () => 1, clearInterval() {}, addEventListener: (key, fn) => {pipEvents[key] = fn;}};
  const window = {confirm: () => confirm, addEventListener() {}};
  if (mode !== 'unsupported') window.documentPictureInPicture = {requestWindow: async () => {
    requests++; if (mode === 'denied') throw new Error('Permissão negada'); return target;
  }};
  class FakeDate extends Date {constructor(...args) {super(...(args.length ? args : [now]));} static now() {return now;}}
  class FakeTimer extends Timer {constructor() {super(() => now);}}
  vm.runInNewContext(source, {PresentationTimer: FakeTimer, Date: FakeDate, Intl, window,
    document: {querySelectorAll: () => [...elements.values()], addEventListener: (key, fn) => {events[key] = fn;}},
    setInterval: fn => {interval = fn; return 1;}});
  return {el: id => elements.get(id), advance(ms) {now += ms; interval();},
    confirm(value) {confirm = value;}, close() {target.closed = true; pipEvents.pagehide();}, target,
    requests: () => requests,
    key(overrides = {}) {let prevented = false; events.keydown({key: ' ', code: 'Space', target: {closest: () => null},
      preventDefault() {prevented = true;}, ...overrides}); return prevented;}};
}
let count = 0;
async function test(name, fn) {await fn(); count++; console.log('OK ' + name);}
(async () => {
  const e = environment();
  await test('interface inicial', () => assert.equal(e.el('count').textContent, '20:00'));
  e.el('toggle').onclick(); e.advance(3000);
  await test('botão inicia contagem', () => assert.equal(e.el('count').textContent, '19:57'));
  e.el('toggle').onclick(); e.advance(30000);
  await test('botão pausa contagem', () => assert.equal(e.el('count').textContent, '19:57'));
  e.el('minutes').value = ''; e.el('apply').onclick();
  await test('campo vazio preserva estado', () => {assert.match(e.el('message').textContent, /Preencha/); assert.equal(e.el('count').textContent, '19:57');});
  e.el('minutes').value = '10'; e.el('warning').value = '11'; e.el('apply').onclick();
  await test('alerta inválido rejeitado', () => assert.equal(e.el('count').textContent, '19:57'));
  e.el('warning').value = '2'; e.el('apply').onclick();
  await test('aplicar preserva decorrido', () => assert.equal(e.el('count').textContent, '09:57'));
  e.confirm(false); e.el('reset').onclick();
  await test('cancelar reinício preserva contagem', () => assert.equal(e.el('count').textContent, '09:57'));
  e.confirm(true); e.el('reset').onclick();
  await test('confirmar reinício zera e pausa', () => {assert.equal(e.el('count').textContent, '10:00'); assert.equal(e.el('toggle').textContent, 'Iniciar');});
  await test('atalho ignora controles e repetição', () => {
    e.key({target: {closest: () => ({})}}); e.key({repeat: true}); e.key({ctrlKey: true});
    assert.equal(e.el('toggle').textContent, 'Iniciar');
  });
  await test('espaço inicia sem rolar página', () => {assert(e.key()); assert.equal(e.el('toggle').textContent, 'Pausar');});
  await Promise.all([e.el('pip').onclick(), e.el('pip').onclick()]);
  await test('aberturas concorrentes são bloqueadas', () => assert.equal(e.requests(), 1));
  e.advance(2000);
  await test('widget movido continua atualizando', () => {assert.equal(e.el('widget').parent, 'pip'); assert.equal(e.el('count').textContent, '09:58');});
  await e.el('pip').onclick();
  await test('janela existente recebe foco', () => {assert.equal(e.target.focuses, 1); assert.equal(e.requests(), 1);});
  e.close(); e.advance(1000);
  await test('fechamento devolve widget sem perder contagem', () => {assert.equal(e.el('widget').parent, 'home'); assert.equal(e.el('count').textContent, '09:57');});
  const unsupported = environment('unsupported'); await unsupported.el('pip').onclick();
  await test('ausência de API tem alternativa', () => assert.match(unsupported.el('message').textContent, /indisponível/));
  const denied = environment('denied'); await denied.el('pip').onclick();
  await test('erro de abertura mantém widget na página', () => {assert.equal(denied.el('widget').parent, 'home'); assert.match(denied.el('message').textContent, /Permissão negada/);});
  console.log(count + ' testes de integração simulada aprovados. Não são testes de navegador, Electron ou suspensão real.');
})().catch(error => {console.error(error); process.exitCode = 1;});
