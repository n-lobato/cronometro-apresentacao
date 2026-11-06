(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let state = null;

  function tick() {
    if (!state) return;
    const v = UI.view(state, Date.now());
    const s = state.settings;
    $('big').textContent = v.text;
    const cls = ['w', v.level];
    if (s.flashOver && v.over && v.running) cls.push('flash');
    if (!s.showEnd) cls.push('hide-end');
    if (!s.showClock) cls.push('hide-clock');
    if ($('w').classList.contains('ping')) cls.push('ping');
    const next = cls.join(' ');
    if ($('w').className !== next) $('w').className = next;
    $('badge').textContent = v.running ? '' : (v.started ? '· PAUSADO' : '· PRONTO');
    $('fim').textContent = v.over ? 'Tempo esgotado' : 'Fim ' + v.endShort;
    $('hora').textContent = v.clock;
    $('bToggle').textContent = v.running ? '❚❚' : '▶';
  }

  document.querySelectorAll('[data-cmd]').forEach((b) => {
    b.addEventListener('click', () => {
      const cmd = { type: b.dataset.cmd };
      if (b.dataset.delta) cmd.deltaMin = Number(b.dataset.delta);
      window.cron.send(cmd);
    });
  });

  /* Sons de aviso gerados na hora (sem arquivos de áudio). */
  let ctx = null;
  function beep(freq, start, dur, vol) {
    ctx = ctx || new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  const SOUNDS = {
    warn: () => { beep(880, 0, 0.18, 0.25); beep(880, 0.3, 0.18, 0.25); },
    crit: () => { beep(988, 0, 0.15, 0.3); beep(988, 0.25, 0.15, 0.3); beep(988, 0.5, 0.15, 0.3); },
    end: () => { beep(1046, 0, 0.3, 0.35); beep(784, 0.35, 0.3, 0.35); beep(523, 0.7, 0.6, 0.35); }
  };

  window.cron.onAlert(({ kind }) => {
    try { if (SOUNDS[kind]) SOUNDS[kind](); } catch (_) { /* sem áudio disponível */ }
    const w = $('w');
    w.classList.remove('ping');
    void w.offsetWidth;
    w.classList.add('ping');
    setTimeout(() => w.classList.remove('ping'), 2800);
  });

  window.cron.onState((s) => { state = s; tick(); });
  window.cron.getState().then((s) => { state = s; tick(); });
  setInterval(tick, 200);
})();
