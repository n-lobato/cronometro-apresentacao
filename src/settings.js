'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
  totalMin: 20,          // duração da apresentação
  warnMin: 5,            // começa o amarelo
  critMin: 1,            // começa o laranja
  overlayVisible: true,  // janelinha do canto ligada
  position: 'top-right', // top-left | top-right | bottom-left | bottom-right | custom
  size: 'm',             // p | m | g
  opacity: 0.92,
  displayId: null,       // monitor escolhido (null = principal)
  customBounds: null,    // posição salva quando o usuário arrasta
  clock: 'brasilia',     // brasilia | local
  showClock: true,
  showEnd: true,
  // Sons desligados por padrão: com o notebook ligado ao projetor por HDMI,
  // o bipe costuma sair nas caixas de som da sala.
  soundWarn: false,
  soundEnd: false,
  flashOver: true,
  shortcuts: true,       // atalhos globais de teclado
  color: 'verde',        // cor do relógio (nome da paleta ou #rrggbb)
  background: 'escuro',  // escuro | preto | claro
  phaseColors: true,     // muda para amarelo/laranja conforme o tempo
  showButtons: true      // botões pequenos na janelinha
});

// Cor de cada opção para fundo escuro (dark) e fundo claro (light).
const COLORS = Object.freeze({
  verde:    { label: 'Verde',    dark: '#3ddc84', light: '#13824a' },
  azul:     { label: 'Azul',     dark: '#4da3ff', light: '#1b5fc4' },
  ciano:    { label: 'Ciano',    dark: '#22d3ee', light: '#0e7f93' },
  branco:   { label: 'Branco',   dark: '#f2f4f8', light: '#1d222b' },
  amarelo:  { label: 'Amarelo',  dark: '#f5c542', light: '#9a6f00' },
  laranja:  { label: 'Laranja',  dark: '#ff8a3d', light: '#c2500c' },
  vermelho: { label: 'Vermelho', dark: '#ff4d4d', light: '#c62828' },
  roxo:     { label: 'Roxo',     dark: '#b38cff', light: '#6a3fc7' },
  rosa:     { label: 'Rosa',     dark: '#ff7ab6', light: '#b8326f' }
});

const BACKGROUNDS = Object.freeze({
  escuro: { label: 'Escuro', bg: '#11141a', fg: '#aab2c0', muted: '#8a93a3', border: '#262c38', light: false },
  preto:  { label: 'Preto',  bg: '#000000', fg: '#b8bfcc', muted: '#8a93a3', border: '#1c1f26', light: false },
  claro:  { label: 'Claro',  bg: '#f4f6f9', fg: '#3a4150', muted: '#5f6878', border: '#cfd5df', light: true }
});

const SIZES = Object.freeze({
  p: { width: 220, height: 92 },
  m: { width: 290, height: 120 },
  g: { width: 390, height: 160 }
});

const ALLOWED = {
  position: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom'],
  size: Object.keys(SIZES),
  clock: ['brasilia', 'local'],
  background: Object.keys(BACKGROUNDS)
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Valida e limpa um conjunto de configurações vindo da tela ou do disco. */
function sanitize(input) {
  const out = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in input)) continue;
    const v = input[key];
    const def = DEFAULTS[key];
    if (ALLOWED[key]) {
      if (ALLOWED[key].includes(v)) out[key] = v;
    } else if (key === 'color') {
      if (COLORS[v] || HEX.test(v)) out[key] = v;
    } else if (key === 'customBounds') {
      if (v && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(v[k]))) {
        out[key] = { x: Math.round(v.x), y: Math.round(v.y), width: Math.round(v.width), height: Math.round(v.height) };
      } else out[key] = null;
    } else if (key === 'displayId') {
      out[key] = Number.isFinite(v) ? v : null;
    } else if (typeof def === 'boolean') {
      out[key] = Boolean(v);
    } else if (typeof def === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) out[key] = n;
    }
  }
  out.totalMin = clamp(out.totalMin, 1, 600);
  out.warnMin = clamp(out.warnMin, 0, 600);
  out.critMin = clamp(out.critMin, 0, 600);
  // Limites invertidos: o maior vira amarelo (alerta) e o menor, laranja.
  if (out.critMin > out.warnMin) [out.warnMin, out.critMin] = [out.critMin, out.warnMin];
  out.opacity = clamp(out.opacity, 0.3, 1);
  return out;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

class SettingsStore {
  constructor(dir) {
    this.file = path.join(dir, 'config.json');
    this.data = { ...DEFAULTS };
    try {
      this.data = sanitize(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch (_) { /* primeira execução ou arquivo inválido */ }
    this._timer = null;
  }

  get() {
    return { ...this.data };
  }

  update(patch) {
    this.data = sanitize({ ...this.data, ...patch });
    this._scheduleSave();
    return this.get();
  }

  _scheduleSave() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.saveNow(), 300);
  }

  saveNow() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Falha ao salvar configurações:', err.message);
    }
  }
}

module.exports = { DEFAULTS, SIZES, COLORS, BACKGROUNDS, sanitize, SettingsStore };
