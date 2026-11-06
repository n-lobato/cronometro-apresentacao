(() => {
  'use strict';
  const elements = new Map(Array.from(document.querySelectorAll('[id]'), el => [el.id, el]));
  const $ = id => elements.get(id);
  const timer = new PresentationTimer();
  const hour = new Intl.DateTimeFormat('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  let pipWindow = null, opening = false;
  function render() {
    const remaining = timer.remaining();
    $('count').textContent = PresentationTimer.format(remaining);
    $('widget').dataset.state = timer.state();
    $('status').textContent = (remaining < 0 ? 'TEMPO ESGOTADO · ' : '') + (timer.running ? 'EM ANDAMENTO' : timer.elapsed() ? 'PAUSADO' : 'PRONTO');
    $('toggle').textContent = timer.running ? 'Pausar' : timer.elapsed() ? 'Continuar' : 'Iniciar';
    $('details').textContent = 'Hora local: ' + hour.format(new Date()) + (remaining >= 0 ? ' · Término estimado: ' + hour.format(new Date(Date.now() + remaining)) : ' · Excesso de tempo');
    if (pipWindow && !pipWindow.closed) pipWindow.document.title = $('count').textContent + ' — Cronômetro';
  }
  function toggle() {timer.toggle(); render();}
  function reset() {if (timer.elapsed() && !window.confirm('Reiniciar e apagar o tempo transcorrido?')) return; timer.reset(); render();}
  function adjust(value) {
    timer.adjust(value); $('minutes').value = timer.total / 60000; $('warning').value = timer.warn / 60000; render();
  }
  function apply() {
    try {
      if (!$('minutes').value.trim() || !$('warning').value.trim()) throw new Error('Preencha os dois campos.');
      timer.configure(Number($('minutes').value), Number($('warning').value));
      $('message').textContent = 'Ajustes aplicados; tempo transcorrido preservado.';
      render();
    } catch (error) {$('message').textContent = error.message;}
  }
  function keys(event) {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
      event.target?.closest('input,textarea,select,button,[contenteditable]')) return;
    if (event.code === 'Space') {event.preventDefault(); toggle();}
    else if (event.key.toLowerCase() === 'r') reset();
    else if (event.key === '+' || event.key === '=') adjust(1);
    else if (event.key === '-') adjust(-1);
  }
  async function openPip() {
    if (pipWindow && !pipWindow.closed) {pipWindow.focus(); return;}
    if (opening) return;
    if (!window.documentPictureInPicture) {
      $('message').textContent = 'Janela flutuante indisponível neste ambiente. No aplicativo desktop, use Modo compacto e Sempre no topo no menu.'; return;
    }
    opening = true;
    try {
      const target = await window.documentPictureInPicture.requestWindow({width: 420, height: 320});
      pipWindow = target;
      const style = target.document.createElement('style'); style.textContent = $('theme').textContent;
      target.document.head.append(style); target.document.documentElement.lang = 'pt-BR';
      target.document.body.className = 'pip'; target.document.body.append($('widget'));
      target.document.addEventListener('keydown', keys);
      const interval = target.setInterval(render, 200);
      target.addEventListener('pagehide', () => {
        target.clearInterval(interval); $('home').append($('widget'));
        if (pipWindow === target) pipWindow = null; render();
      }, {once: true});
      $('message').textContent = 'Janela flutuante aberta. Mantenha esta página aberta.'; render();
    } catch (error) {$('home').append($('widget')); pipWindow = null; $('message').textContent = 'Falha ao abrir janela: ' + error.message;}
    finally {opening = false;}
  }
  $('toggle').onclick = toggle; $('reset').onclick = reset; $('apply').onclick = apply;
  $('plus').onclick = () => adjust(1); $('minus').onclick = () => adjust(-1); $('pip').onclick = openPip;
  document.addEventListener('keydown', keys); document.addEventListener('visibilitychange', render);
  window.addEventListener('pageshow', render); setInterval(render, 200); render();
})();
