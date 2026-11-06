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
  soundWarn: true,
  soundEnd: true,
  flashOver: true,
  shortcuts: true        // atalhos globais de teclado
});

const SIZES = Object.freeze({
  p: { width: 220, height: 92 },
  m: { width: 290, height: 120 },
  g: { width: 390, height: 160 }
});

const ALLOWED = {
  position: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom'],
  size: Object.keys(SIZES),
  clock: ['brasilia', 'local']
};

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

module.exports = { DEFAULTS, SIZES, sanitize, SettingsStore };
