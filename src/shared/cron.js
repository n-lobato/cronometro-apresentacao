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

  const MIN_TOTAL_MS = 60000;        // 1 minuto
  const MAX_TOTAL_MS = 600 * 60000;  // 600 minutos (mesmo limite do campo de duração)

  /** Estado visual: ok, warn (amarelo), crit (laranja) ou over (estourado). */
  function stateOf(remMs, warnMs, critMs) {
    if (critMs == null) critMs = 60000;
    // Se os limites vierem invertidos, o maior vale como amarelo e o menor
    // como laranja. Sem isso a fase amarela nunca apareceria.
    if (critMs > warnMs) { const tmp = critMs; critMs = warnMs; warnMs = tmp; }
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

  /** Soma ou subtrai tempo do total, sempre entre 1 e 600 minutos. */
  function adjust(timer, deltaMs, minMs, maxMs) {
    if (minMs == null) minMs = MIN_TOTAL_MS;
    if (maxMs == null) maxMs = MAX_TOTAL_MS;
    return { ...timer, totalMs: Math.min(maxMs, Math.max(minMs, timer.totalMs + deltaMs)) };
  }

  /**
   * Avisos de prova: devolve os minutos (ex.: 30, 15, 5) cujo limite foi
   * atravessado entre a leitura anterior e a atual do tempo restante.
   */
  function crossed(prevRemMs, remMs, minutesList) {
    if (prevRemMs == null || !Array.isArray(minutesList)) return [];
    return minutesList.filter(m => prevRemMs > m * 60000 && remMs <= m * 60000);
  }

  /** Converte "30, 15, 5" em [30, 15, 5]: inteiros de 1 a 600, sem repetir, do maior para o menor. */
  function parseMinutesList(input) {
    const raw = Array.isArray(input) ? input : String(input == null ? '' : input).split(/[^0-9]+/);
    const nums = raw.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 600);
    return [...new Set(nums)].sort((a, b) => b - a).slice(0, 10);
  }

  const api = { elapsed, remaining, isRunning, format, stateOf, toggle, reset, adjust, crossed, parseMinutesList, MIN_TOTAL_MS, MAX_TOTAL_MS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cron = api;
})(typeof window !== 'undefined' ? window : this);
