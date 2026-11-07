(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
  let state = null;

  const send = (cmd) => window.cron.send(cmd);
  const setSetting = (patch) => send({ type: 'settings', patch });

  /* ---------- montagem inicial ---------- */

  PRESETS.forEach((m) => {
    const b = document.createElement('button');
    b.textContent = m + ' min';
    b.dataset.preset = m;
    b.addEventListener('click', () => send({ type: 'setTotal', min: m }));
    $('presets').appendChild(b);
  });

  document.querySelectorAll('[data-cmd]').forEach((b) => {
    b.addEventListener('click', () => {
      const cmd = { type: b.dataset.cmd };
      if (b.dataset.delta) cmd.deltaMin = Number(b.dataset.delta);
      send(cmd);
    });
  });

  $('inTotal').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    if (v > 0) send({ type: 'setTotal', min: v });
  });

  document.querySelectorAll('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    const evt = el.type === 'range' ? 'input' : 'change';
    el.addEventListener(evt, () => {
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else v = Number(el.value);
      setSetting({ [key]: v });
    });
  });

  document.querySelectorAll('#corners [data-pos]').forEach((b) =>
    b.addEventListener('click', () => setSetting({ position: b.dataset.pos })));
  document.querySelectorAll('#sizes [data-size]').forEach((b) =>
    b.addEventListener('click', () => setSetting({ size: b.dataset.size })));
  document.querySelectorAll('#clocks [data-clock]').forEach((b) =>
    b.addEventListener('click', () => setSetting({ clock: b.dataset.clock })));

  $('display').addEventListener('change', (e) => {
    const v = e.target.value;
    setSetting({ displayId: v === '' ? null : Number(v), position: state && state.settings.position === 'custom' ? 'top-right' : state.settings.position });
  });

  $('customColor').addEventListener('change', (e) => setSetting({ color: e.target.value }));

  function buildAppearance() {
    if ($('colors').childElementCount) return;
    const pal = state.palette;
    Object.entries(pal.colors).forEach(([id, c]) => {
      const b = document.createElement('button');
      b.dataset.color = id;
      b.title = c.label;
      b.style.background = c.dark;
      b.addEventListener('click', () => setSetting({ color: id }));
      $('colors').appendChild(b);
    });
    Object.entries(pal.backgrounds).forEach(([id, bg]) => {
      const b = document.createElement('button');
      b.dataset.bg = id;
      b.textContent = bg.label;
      b.addEventListener('click', () => setSetting({ background: id }));
      $('bgs').appendChild(b);
    });
  }

  $('repo').addEventListener('click', (e) => { e.preventDefault(); send({ type: 'open:repo' }); });

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Space') { e.preventDefault(); send({ type: 'toggle' }); }
    else if (e.key === 'r' || e.key === 'R') send({ type: 'reset' });
    else if (e.key === '+' || e.key === '=') send({ type: 'adjust', deltaMin: 1 });
    else if (e.key === '-') send({ type: 'adjust', deltaMin: -1 });
  });

  /* ---------- atualização a partir do estado ---------- */

  function setValue(el, value) {
    if (document.activeElement === el) return; // não atrapalha quem está digitando
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else if (String(el.value) !== String(value)) el.value = value;
  }

  function render() {
    if (!state) return;
    const s = state.settings;
    buildAppearance();
    document.querySelectorAll('#colors [data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === s.color));
    document.querySelectorAll('#bgs [data-bg]').forEach((b) => b.classList.toggle('on', b.dataset.bg === s.background));
    const hex = state.palette.colors[s.color] ? state.palette.colors[s.color].dark : s.color;
    setValue($('customColor'), hex);
    $('colorWarn').textContent = (s.color === 'vermelho' || s.color === 'laranja' || s.color === 'amarelo')
      ? 'Atenção: essa cor se confunde com os avisos de tempo. O fim do tempo continua indicado pelo "+" e pelo piscar.'
      : '';

    setValue($('inTotal'), Math.round(state.timer.totalMs / 60000));
    document.querySelectorAll('[data-setting]').forEach((el) => setValue(el, s[el.dataset.setting]));
    document.querySelectorAll('#presets [data-preset]').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.preset) * 60000 === state.timer.totalMs));
    document.querySelectorAll('#corners [data-pos]').forEach((b) => b.classList.toggle('on', b.dataset.pos === s.position));
    document.querySelectorAll('#sizes [data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === s.size));
    document.querySelectorAll('#clocks [data-clock]').forEach((b) => b.classList.toggle('on', b.dataset.clock === s.clock));
    $('customHint').textContent = s.position === 'custom'
      ? 'Posição livre (arrastada). Clique em um canto para voltar ao padrão.'
      : 'Você também pode arrastar a janelinha para qualquer lugar.';

    const sel = $('display');
    const opts = [{ id: '', label: 'Monitor principal' }].concat(
      state.displays.map((d) => ({ id: String(d.id), label: `${d.label} (${d.size})${d.primary ? ' · principal' : ''}` })));
    const sig = JSON.stringify(opts);
    if (sel.dataset.sig !== sig) {
      sel.innerHTML = '';
      opts.forEach((o) => {
        const op = document.createElement('option');
        op.value = o.id;
        op.textContent = o.label;
        sel.appendChild(op);
      });
      sel.dataset.sig = sig;
    }
    setValue(sel, s.displayId == null ? '' : String(s.displayId));

    const tb = $('shortcuts');
    tb.innerHTML = '';
    state.shortcuts.forEach((k) => {
      const tr = document.createElement('tr');
      if (state.shortcutFailures.includes(k.accel)) tr.className = 'fail';
      const a = document.createElement('td');
      a.textContent = UI.prettyAccel(k.accel, state.platform);
      const b = document.createElement('td');
      b.textContent = k.label;
      tr.append(a, b);
      tb.appendChild(tr);
    });
    $('shortcutFail').textContent = state.shortcutFailures.length
      ? 'Alguns atalhos riscados já estão em uso por outro programa e não foram ativados.'
      : '';

    $('trayNote').textContent = state.hasTray
      ? 'Fechar esta janela mantém o cronômetro ativo na bandeja do sistema.'
      : 'Fechar esta janela encerra o programa.';
    $('version').textContent = 'v' + state.version + ' · n-lobato';
    tick();
  }

  function tick() {
    if (!state) return;
    const v = UI.view(state, Date.now());
    $('big').textContent = v.text;
    $('big').className = 'big ' + v.level;
    // Prévia da cor escolhida (sempre na versão para fundo escuro do painel).
    UI.applyTheme({ ...state, settings: { ...state.settings, background: 'escuro' } }, $('big'));
    $('sDec').textContent = v.elapsedMin + ' min';
    $('sTot').textContent = v.totalMin + ' min';
    $('sFim').textContent = v.over ? 'esgotado' : v.endLong;
    $('sHora').textContent = v.clock;
    $('sHoraLbl').textContent = v.clockLabel;
    $('bToggle').textContent = v.running ? 'Pausar' : (v.started ? 'Continuar' : 'Iniciar');
    document.title = (v.started ? v.text + ' · ' : '') + 'Cronômetro de Apresentação';
  }

  window.cron.onState((s) => { state = s; render(); });
  window.cron.getState().then((s) => { state = s; render(); });
  setInterval(tick, 200);
})();
