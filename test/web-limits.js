'use strict';

/*
 * Teste da versão para navegador, usando o Electron como navegador.
 * Uso: npx electron test/web-limits.js   (no Linux sem tela: xvfb-run -a ... --no-sandbox)
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const checks = require('./web-checks');

app.whenReady().then(async () => {
  const guard = setTimeout(() => { console.error('WEB: tempo esgotado'); app.exit(2); }, 30000);
  const errors = [];
  try {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
    win.webContents.on('console-message', (e, level, message) => {
      const lvl = e && e.level !== undefined ? e.level : level;
      const msg = e && e.message !== undefined ? e.message : message;
      if (lvl === 'error' || lvl === 3) errors.push('console: ' + msg);
    });
    await win.loadFile(path.join(__dirname, '..', 'docs', 'index.html'));
    const fails = await win.webContents.executeJavaScript(checks);
    errors.push(...fails);
  } catch (err) {
    errors.push('falha: ' + err.message);
  }
  clearTimeout(guard);
  if (errors.length) {
    console.error('WEB: FALHOU\n  ' + errors.join('\n  '));
    app.exit(1);
  } else {
    console.log('WEB: ok (limites da versão para navegador conferidos)');
    app.exit(0);
  }
});
