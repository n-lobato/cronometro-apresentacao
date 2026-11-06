'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cron', {
  getState: () => ipcRenderer.invoke('get-state'),
  send: (cmd) => ipcRenderer.send('command', cmd),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onAlert: (cb) => ipcRenderer.on('alert', (_e, a) => cb(a))
});
