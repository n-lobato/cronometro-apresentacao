const {app, BrowserWindow, Menu} = require('electron');
const path = require('node:path');
let win, compactStyle;
function createWindow() {
  win = new BrowserWindow({width: 1000, height: 740, minWidth: 340, minHeight: 300,
    backgroundColor: '#0f1218', webPreferences: {nodeIntegration: false, contextIsolation: true, sandbox: true}});
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label: 'Cronômetro', submenu: [
      {label: 'Modo compacto', type: 'checkbox', accelerator: 'CommandOrControl+Shift+C', click: async item => {
        try {
          if (item.checked) {
            compactStyle = await win.webContents.insertCSS('h1,.settings,.help,#message{display:none}body{padding:8px}#count{font-size:68px}#widget{padding:10px}');
            win.setSize(440, 340);
          } else {if (compactStyle) await win.webContents.removeInsertedCSS(compactStyle); compactStyle = null; win.setSize(1000, 740);}
        } catch (error) {console.error(error);}
      }},
      {label: 'Sempre no topo', type: 'checkbox', click: item => win.setAlwaysOnTop(item.checked)},
      {type: 'separator'}, {role: 'quit', label: 'Sair'}
    ]}, {role: 'editMenu', label: 'Editar'}, {role: 'viewMenu', label: 'Exibir'}
  ]));
  win.on('closed', () => {win = null; compactStyle = null;});
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});
app.on('activate', () => {if (BrowserWindow.getAllWindows().length === 0) createWindow();});
