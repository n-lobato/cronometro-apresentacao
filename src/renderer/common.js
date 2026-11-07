/* Funções de apoio usadas pelas duas telas. */
(function () {
  'use strict';
  const cache = {};

  function timeFormatter(clock, withSeconds) {
    const key = clock + (withSeconds ? 's' : '');
    if (!cache[key]) {
      const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
      if (withSeconds) opts.second = '2-digit';
      if (clock === 'brasilia') opts.timeZone = 'America/Sao_Paulo';
      cache[key] = new Intl.DateTimeFormat('pt-BR', opts);
    }
    return cache[key];
  }

  /** Calcula tudo o que as telas mostram a partir do estado recebido. */
  function view(state, now) {
    const t = state.timer;
    const s = state.settings;
    const el = Cron.elapsed(t, now);
    const rem = Cron.remaining(t, now);
    const level = Cron.stateOf(rem, s.warnMin * 60000, s.critMin * 60000);
    const running = Cron.isRunning(t);
    const end = new Date(now + Math.max(rem, 0));
    return {
      text: Cron.format(rem),
      level,
      running,
      started: running || el > 0,
      elapsedMin: Math.floor(el / 60000),
      totalMin: Math.round(t.totalMs / 60000),
      over: rem < 0,
      endShort: timeFormatter(s.clock, false).format(end),
      endLong: timeFormatter(s.clock, true).format(end),
      clock: timeFormatter(s.clock, true).format(new Date(now)),
      clockLabel: s.clock === 'brasilia' ? 'Hora de Brasília' : 'Hora local'
    };
  }

  function prettyAccel(accel, platform) {
    const mac = platform === 'darwin';
    return accel
      .replace('CommandOrControl', mac ? '⌘' : 'Ctrl')
      .replace('Alt', mac ? '⌥' : 'Alt')
      .replace('Up', '↑')
      .replace('Down', '↓')
      .split('+').join(mac ? ' ' : ' + ');
  }

  /** Calcula as cores do tema escolhido. */
  function theme(state) {
    const s = state.settings;
    const pal = state.palette;
    const bg = pal.backgrounds[s.background] || pal.backgrounds.escuro;
    const L = bg.light;
    const c = pal.colors[s.color];
    const base = c ? (L ? c.light : c.dark) : s.color;
    const phase = s.phaseColors;
    return {
      '--base': base,
      '--warn': phase ? (L ? '#9a6f00' : '#f5c542') : base,
      '--crit': phase ? (L ? '#c2500c' : '#ff8a3d') : base,
      '--over': L ? '#c62828' : '#ff4d4d',
      '--bg': bg.bg,
      '--fg': bg.fg,
      '--muted': bg.muted,
      '--border': bg.border,
      '--flash': L ? '#ffd2d2' : '#4a1212',
      '--ping': L ? '#ffefb8' : '#3d3410',
      '--btn-bg': L ? '#e3e7ee' : '#1c212c',
      '--btn-hover': L ? '#d3d9e3' : '#2b3242',
      '--btn-fg': L ? '#1d222b' : '#e8ebf0',
      '--btn-border': L ? '#c3cad6' : '#2b3240'
    };
  }

  function applyTheme(state, el) {
    const vars = theme(state);
    for (const k of Object.keys(vars)) {
      if (el.style.getPropertyValue(k) !== vars[k]) el.style.setProperty(k, vars[k]);
    }
  }

  window.UI = { view, prettyAccel, theme, applyTheme };
})();
