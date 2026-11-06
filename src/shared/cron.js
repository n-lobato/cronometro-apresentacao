/*
 * Lógica pura do cronômetro, compartilhada entre o processo principal,
 * as telas do aplicativo e os testes.
 */
(function (root) {
  'use strict';

  /** Tempo decorrido (ms) considerando pausas. */
  function elapsed(timer, now) {
    return timer.accMs + (timer.startedAt != null ? now - timer.startedAt : 0);
  }

  /** Tempo restante (ms). Fica negativo quando o tempo estoura. */
  function remaining(timer, now) {
    return timer.totalMs - elapsed(timer, now);
  }

  function isRunning(timer) {
    return timer.startedAt != null;
  }

  /**
   * Formata em MM:SS (minutos sem limite, ex.: 179:26).
   * Contagem regressiva arredonda para cima, para mostrar 20:00 no início.
   * Tempo estourado aparece com "+" (ex.: +01:05).
   */
  function format(ms) {
    const over = ms < 0;
    const s = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return (over ? '+' : '') + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  /** Estado visual: ok, warn (amarelo), crit (último minuto) ou over (estourado). */
  function stateOf(remMs, warnMs, critMs) {
    if (critMs == null) critMs = 60000;
    if (remMs < 0) return 'over';
    if (remMs <= critMs) return 'crit';
    if (remMs <= warnMs) return 'warn';
    return 'ok';
  }

  function toggle(timer, now) {
    if (isRunning(timer)) {
      return { ...timer, accMs: timer.accMs + (now - timer.startedAt), startedAt: null };
    }
    return { ...timer, startedAt: now };
  }

  function reset(timer) {
    return { ...timer, accMs: 0, startedAt: null };
  }

  function adjust(timer, deltaMs, minMs) {
    if (minMs == null) minMs = 60000;
    return { ...timer, totalMs: Math.max(minMs, timer.totalMs + deltaMs) };
  }

  const api = { elapsed, remaining, isRunning, format, stateOf, toggle, reset, adjust };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cron = api;
})(typeof window !== 'undefined' ? window : this);
