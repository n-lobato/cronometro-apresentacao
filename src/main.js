'use strict';

const {
  app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu,
  nativeImage, shell, powerSaveBlocker
} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Cron = require('./shared/cron');
const { SIZES, SettingsStore } = require('./settings');

const SMOKE = process.argv.includes('--smoke-test');
const IS_MAC = process.platform === 'darwin';
const MARGIN = 16;
const REPO_URL = 'https://github.com/n-lobato/cronometro-apresentacao';
const ASSETS = path.join(__dirname, '..', 'assets');
const PRELOAD = path.join(__dirname, 'preload.js');

const SHORTCUTS = [
  { accel: 'CommandOrControl+Alt+S', label: 'Iniciar / pausar', cmd: { type: 'toggle' } },
  { accel: 'CommandOrControl+Alt+R', label: 'Reiniciar', cmd: { type: 'reset' } },
  { accel: 'CommandOrControl+Alt+Up', label: '+1 minuto', cmd: { type: 'adjust', deltaMin: 1 } },
  { accel: 'CommandOrControl+Alt+Down', label: '-1 minuto', cmd: { type: 'adjust', deltaMin: -1 } },
  { accel: 'CommandOrControl+Alt+O', label: 'Mostrar / ocultar o cronômetro do canto', cmd: { type: 'overlay:toggle' } },
  { accel: 'CommandOrControl+Alt+P', label: 'Abrir o painel', cmd: { type: 'panel:show' } }
];

let settings;
let timer = { totalMs: 20 * 60000, accMs: 0, startedAt: null };
let panel = null;
let overlay = null;
let tray = null;
let quitting = false;
let shortcutFailures = [];
let alertLevel = 'ok';
let ignoreMovesUntil = 0;
let moveDebounce = null;
let blockerId = null;
let lastTrayTitle = '';

if (SMOKE) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cronometro-smoke-')));
}

const gotLock = SMOKE || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showPanel());
  app.whenReady().then(start);
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

function start() {
  settings = new SettingsStore(app.getPath('userData'));
  timer.totalMs = settings.get().totalMin * 60000;

  ipcMain.handle('get-state', () => snapshot());
  ipcMain.on('command', (_e, cmd) => command(cmd));

  createPanel();
  createOverlay();
  createTray();
  registerShortcuts();

  screen.on('display-added', onDisplaysChanged);
  screen.on('display-removed', onDisplaysChanged);
  screen.on('display-metrics-changed', onDisplaysChanged);

  // Mantém a janelinha por cima mesmo quando o PowerPoint/leitor de PDF
  // entra em tela cheia e tenta ocupar a camada superior.
  setInterval(keepOnTop, 1500);
  setInterval(tickAlerts, 250);

  app.on('activate', () => showPanel());
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (settings) settings.saveNow();
  });

  if (SMOKE) runSmokeTest();
}

/* ------------------------------------------------------------------ */
/* Estado e comandos                                                   */
/* ------------------------------------------------------------------ */

function snapshot() {
  const primary = screen.getPrimaryDisplay();
  return {
    timer,
    settings: settings.get(),
    displays: screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: (d.label && d.label.trim()) || `Monitor ${i + 1}`,
      primary: d.id === primary.id,
      size: `${d.size.width}x${d.size.height}`
    })),
    shortcuts: SHORTCUTS.map(s => ({ accel: s.accel, label: s.label })),
    shortcutFailures,
    platform: process.platform,
    version: app.getVersion(),
    repoUrl: REPO_URL,
    hasTray: Boolean(tray)
  };
}

function broadcast() {
  const snap = snapshot();
  for (const win of [panel, overlay]) {
    if (win && !win.isDestroyed()) win.webContents.send('state', snap);
  }
  updateTrayMenu();
  updatePowerBlocker();
}

function command(cmd) {
  if (!cmd || typeof cmd.type !== 'string') return;
  const now = Date.now();
  switch (cmd.type) {
    case 'toggle':
      timer = Cron.toggle(timer, now);
      break;
    case 'start':
      if (!Cron.isRunning(timer)) timer = Cron.toggle(timer, now);
      break;
    case 'reset':
      timer = Cron.reset(timer);
      alertLevel = 'ok';
      break;
    case 'adjust': {
      const delta = Number(cmd.deltaMin);
      if (Number.isFinite(delta)) timer = Cron.adjust(timer, delta * 60000);
      break;
    }
    case 'setTotal': {
      const s = settings.update({ totalMin: Number(cmd.min) });
      timer = { ...timer, totalMs: s.totalMin * 60000 };
      alertLevel = Cron.stateOf(Cron.remaining(timer, now), s.warnMin * 60000, s.critMin * 60000);
      break;
    }
    case 'settings':
      applySettings(cmd.patch || {});
      break;
    case 'overlay:toggle':
      applySettings({ overlayVisible: !settings.get().overlayVisible });
      break;
    case 'overlay:hide':
      applySettings({ overlayVisible: false });
      break;
    case 'panel:show':
      showPanel();
      break;
    case 'open:repo':
      shell.openExternal(REPO_URL);
      break;
    case 'quit':
      quitting = true;
      app.quit();
      return;
    default:
      return;
  }
  broadcast();
}

function applySettings(patch) {
  const before = settings.get();
  if (patch.size && before.position === 'custom' && before.customBounds) {
    const sz = SIZES[patch.size];
    if (sz) patch = { ...patch, customBounds: { ...before.customBounds, ...sz } };
  }
  const s = settings.update(patch);

  if (overlay && !overlay.isDestroyed()) {
    if ('opacity' in patch) overlay.setOpacity(s.opacity);
    if ('position' in patch || 'size' in patch || 'displayId' in patch) placeOverlay();
    if ('overlayVisible' in patch) {
      if (s.overlayVisible) { placeOverlayIfOffscreen(); overlay.showInactive(); keepOnTop(); }
      else overlay.hide();
    }
  }
  if ('shortcuts' in patch) registerShortcuts();
  if ('warnMin' in patch || 'critMin' in patch) {
    alertLevel = Cron.stateOf(Cron.remaining(timer, Date.now()), s.warnMin * 60000, s.critMin * 60000);
  }
}

/* ------------------------------------------------------------------ */
/* Alertas (sons e piscar)                                             */
/* ------------------------------------------------------------------ */

const LEVEL_ORDER = { ok: 0, warn: 1, crit: 2, over: 3 };

function tickAlerts() {
  if (!settings) return;
  const s = settings.get();
  const rem = Cron.remaining(timer, Date.now());
  const level = Cron.stateOf(rem, s.warnMin * 60000, s.critMin * 60000);

  if (Cron.isRunning(timer) && LEVEL_ORDER[level] > LEVEL_ORDER[alertLevel]) {
    let kind = null;
    if (level === 'over' && s.soundEnd) kind = 'end';
    else if (level === 'crit' && s.soundWarn) kind = 'crit';
    else if (level === 'warn' && s.soundWarn) kind = 'warn';
    if (kind && overlay && !overlay.isDestroyed()) overlay.webContents.send('alert', { kind });
  }
  alertLevel = level;

  // No macOS o tempo também aparece na barra de menus.
  if (IS_MAC && tray) {
    const title = (Cron.isRunning(timer) || timer.accMs > 0) ? ' ' + Cron.format(rem) : '';
    if (title !== lastTrayTitle) {
      tray.setTitle(title);
      lastTrayTitle = title;
    }
  }
}

function updatePowerBlocker() {
  const running = Cron.isRunning(timer);
  if (running && blockerId === null) {
    blockerId = powerSaveBlocker.start('prevent-display-sleep');
  } else if (!running && blockerId !== null) {
    powerSaveBlocker.stop(blockerId);
    blockerId = null;
  }
}

/* ------------------------------------------------------------------ */
/* Janela do painel                                                    */
/* ------------------------------------------------------------------ */

function createPanel() {
  panel = new BrowserWindow({
    width: 940,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    title: 'Cronômetro de Apresentação',
    backgroundColor: '#0f1218',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  if (!IS_MAC) panel.removeMenu();
  panel.loadFile(path.join(__dirname, 'renderer', 'panel.html'));
  panel.once('ready-to-show', () => panel.show());

  panel.on('close', (e) => {
    if (quitting) return;
    if (tray) {
      e.preventDefault();
      panel.hide();
    } else {
      quitting = true;
      app.quit();
    }
  });

  // Links externos abrem no navegador padrão.
  panel.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showPanel() {
  if (!panel || panel.isDestroyed()) createPanel();
  if (panel.isMinimized()) panel.restore();
  panel.show();
  panel.focus();
}

/* ------------------------------------------------------------------ */
/* Janelinha flutuante (overlay)                                       */
/* ------------------------------------------------------------------ */

function targetDisplay() {
  const id = settings.get().displayId;
  return screen.getAllDisplays().find(d => d.id === id) || screen.getPrimaryDisplay();
}

function computeOverlayBounds() {
  const s = settings.get();
  const sz = SIZES[s.size] || SIZES.m;
  if (s.position === 'custom' && s.customBounds && isOnSomeDisplay(s.customBounds)) {
    return { ...s.customBounds };
  }
  // Usa a área total do monitor (e não a área de trabalho), porque em
  // tela cheia a barra de tarefas some.
  const b = targetDisplay().bounds;
  const pos = s.position === 'custom' ? 'top-right' : s.position;
  const x = pos.endsWith('left') ? b.x + MARGIN : b.x + b.width - sz.width - MARGIN;
  const y = pos.startsWith('top') ? b.y + MARGIN : b.y + b.height - sz.height - MARGIN;
  return { x: Math.round(x), y: Math.round(y), width: sz.width, height: sz.height };
}

function isOnSomeDisplay(r) {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return screen.getAllDisplays().some(d => {
    const b = d.bounds;
    return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
  });
}

function placeOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  ignoreMovesUntil = Date.now() + 800;
  overlay.setBounds(computeOverlayBounds());
}

function placeOverlayIfOffscreen() {
  if (overlay && !overlay.isDestroyed() && !isOnSomeDisplay(overlay.getBounds())) placeOverlay();
}

function createOverlay() {
  const s = settings.get();
  overlay = new BrowserWindow({
    ...computeOverlayBounds(),
    minWidth: 160,
    minHeight: 70,
    frame: false,
    transparent: false,
    backgroundColor: '#11141a',
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Não rouba o foco do PowerPoint/leitor de PDF ao clicar no cronômetro,
    // assim as setas e o passador de slides continuam funcionando.
    focusable: false,
    hasShadow: true,
    show: false,
    title: 'Cronômetro',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setOpacity(s.opacity);
  overlay.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlay.once('ready-to-show', () => {
    if (settings.get().overlayVisible || SMOKE) overlay.showInactive();
  });

  const onUserMove = () => {
    if (Date.now() < ignoreMovesUntil) return;
    clearTimeout(moveDebounce);
    moveDebounce = setTimeout(() => {
      if (!overlay || overlay.isDestroyed()) return;
      settings.update({ position: 'custom', customBounds: overlay.getBounds() });
      broadcast();
    }, 400);
  };
  overlay.on('move', onUserMove);
  overlay.on('resize', onUserMove);

  overlay.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      applySettings({ overlayVisible: false });
      broadcast();
    }
  });
}

function keepOnTop() {
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  overlay.setAlwaysOnTop(true, 'screen-saver');
  if (!IS_MAC) overlay.moveTop();
}

function onDisplaysChanged() {
  placeOverlayIfOffscreen();
  const s = settings.get();
  if (s.position !== 'custom') placeOverlay();
  broadcast();
}

/* ------------------------------------------------------------------ */
/* Bandeja / barra de menus                                            */
/* ------------------------------------------------------------------ */

function createTray() {
  try {
    const file = IS_MAC ? 'trayTemplate.png' : 'tray.png';
    const img = nativeImage.createFromPath(path.join(ASSETS, file));
    if (img.isEmpty()) return;
    if (IS_MAC) img.setTemplateImage(true);
    tray = new Tray(img);
    tray.setToolTip('Cronômetro de Apresentação');
    if (!IS_MAC) tray.on('click', () => showPanel());
    updateTrayMenu();
  } catch (err) {
    console.error('Bandeja indisponível:', err.message);
    tray = null;
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const running = Cron.isRunning(timer);
  const s = settings.get();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o painel', click: () => showPanel() },
    { type: 'separator' },
    { label: running ? 'Pausar' : (timer.accMs > 0 ? 'Continuar' : 'Iniciar'), click: () => command({ type: 'toggle' }) },
    { label: 'Reiniciar', click: () => command({ type: 'reset' }) },
    { label: '+1 minuto', click: () => command({ type: 'adjust', deltaMin: 1 }) },
    { label: '-1 minuto', click: () => command({ type: 'adjust', deltaMin: -1 }) },
    { type: 'separator' },
    { label: s.overlayVisible ? 'Ocultar o cronômetro do canto' : 'Mostrar o cronômetro do canto', click: () => command({ type: 'overlay:toggle' }) },
    { type: 'separator' },
    { label: 'Sair', click: () => command({ type: 'quit' }) }
  ]));
}

/* ------------------------------------------------------------------ */
/* Atalhos globais                                                     */
/* ------------------------------------------------------------------ */

function registerShortcuts() {
  globalShortcut.unregisterAll();
  shortcutFailures = [];
  if (!settings.get().shortcuts) return;
  for (const s of SHORTCUTS) {
    let ok = false;
    try {
      ok = globalShortcut.register(s.accel, () => command(s.cmd));
    } catch (_) {
      ok = false;
    }
    if (!ok) shortcutFailures.push(s.accel);
  }
}

/* ------------------------------------------------------------------ */
/* Teste automático (usado no GitHub Actions)                          */
/* ------------------------------------------------------------------ */

function runSmokeTest() {
  const outDir = process.env.SMOKE_OUT || path.join(process.cwd(), 'smoke-output');
  fs.mkdirSync(outDir, { recursive: true });
  const errors = [];

  const watch = (win, name) => {
    const wc = win.webContents;
    wc.on('console-message', (e, level, message) => {
      const lvl = e && e.level !== undefined ? e.level : level;
      const msg = e && e.message !== undefined ? e.message : message;
      if (lvl === 'error' || lvl === 3) errors.push(`${name}: ${msg}`);
    });
    wc.on('preload-error', (_e, p, err) => errors.push(`${name} preload: ${err && err.message}`));
    wc.on('did-fail-load', (_e, code, desc) => errors.push(`${name} load: ${code} ${desc}`));
    wc.on('render-process-gone', (_e, d) => errors.push(`${name} renderer: ${d.reason}`));
  };
  watch(panel, 'painel');
  watch(overlay, 'overlay');

  const guard = setTimeout(() => {
    console.error('SMOKE: tempo esgotado');
    app.exit(2);
  }, 45000);

  const loaded = (win) => new Promise(res => {
    if (!win.webContents.isLoading()) res();
    else win.webContents.once('did-finish-load', res);
  });

  Promise.all([loaded(panel), loaded(overlay)])
    .then(() => wait(800))
    .then(() => { command({ type: 'setTotal', min: 20 }); command({ type: 'start' }); })
    .then(() => wait(2600))
    .then(async () => {
      const big = await overlay.webContents.executeJavaScript('document.getElementById("big").textContent');
      const panelBig = await panel.webContents.executeJavaScript('document.getElementById("big").textContent');
      if (!/^\d{2}:\d{2}$/.test(big) || big === '20:00') errors.push(`overlay mostrou "${big}"`);
      if (!/^\d{2}:\d{2}$/.test(panelBig)) errors.push(`painel mostrou "${panelBig}"`);
      fs.writeFileSync(path.join(outDir, 'painel.png'), (await panel.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(outDir, 'overlay.png'), (await overlay.webContents.capturePage()).toPNG());
      const report = { ok: errors.length === 0, overlay: big, panel: panelBig, errors, platform: process.platform, electron: process.versions.electron };
      fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
      console.log('SMOKE:', JSON.stringify(report));
      clearTimeout(guard);
      quitting = true;
      app.exit(errors.length ? 1 : 0);
    })
    .catch(err => {
      console.error('SMOKE: falha', err);
      app.exit(1);
    });
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}
