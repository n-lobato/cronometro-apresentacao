(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const BANNER_MS = 60000; // o aviso "Faltam X minutos" fica 1 minuto na tela
  let state = null;
  let bannerTimer = null;

  function tick() {
    if (!state) return;
    const v = UI.view(state, Date.now());
    const s = state.settings;
    const paused = v.started && !v.running;

    $('title').textContent = s.examTitle || '';
    $('screen').className = 'screen ' + v.level + (paused ? ' paused' : '');
    $('label').textContent = v.over ? '\u00a0' : (v.started ? 'TEMPO RESTANTE' : 'AGUARDANDO INÍCIO');
    // Na prova, quando o tempo acaba, não se conta o excesso.
    $('big').textContent = v.over ? 'TEMPO ESGOTADO' : v.text;
    $('state').textContent = paused && !v.over ? 'PAUSADO' : '';
    $('sDec').textContent = v.elapsedMin + ' min';
    $('sTot').textContent = v.totalMin + ' min';
    $('sFim').textContent = v.over ? 'Encerrado' : v.endLong;
    $('sHora').textContent = v.clock;
    $('sHoraLbl').textContent = v.clockLabel;

    const light = state.palette.backgrounds[s.background] && state.palette.backgrounds[s.background].light;
    document.body.classList.toggle('light', Boolean(light));
    UI.applyTheme(state, document.documentElement);
  }

  function showBanner(minutes) {
    const b = $('banner');
    b.textContent = minutes === 1 ? 'FALTA 1 MINUTO' : `FALTAM ${minutes} MINUTOS`;
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), BANNER_MS);
  }

  /* Cliques não fazem nada (evita pausar sem querer). O botão direito abre o
     menu, e pausar ou retomar exige escolher a opção nele. */
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.cron.send({ type: 'exam:menu' });
  });
  document.addEventListener('dblclick', (e) => e.preventDefault());

  /* Esc pede confirmação antes de sair. Nenhuma tecla sozinha pausa. */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      window.cron.send({ type: 'exam:exit-request' });
    }
  });

  /* Esconde o cursor do mouse depois de 2 segundos parado. */
  let idleTimer = null;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 2000);
  };
  document.addEventListener('mousemove', wake);
  wake();

  window.cron.onBanner(({ minutes }) => showBanner(minutes));
  window.cron.onState((s) => { state = s; tick(); });
  window.cron.getState().then((s) => { state = s; tick(); });
  setInterval(tick, 200);
})();
