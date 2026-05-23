const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getQuotes: () => ipcRenderer.invoke('get-quotes'),
  saveQuotes: (q) => ipcRenderer.invoke('save-quotes', q),
  openSettings: () => ipcRenderer.send('open-settings'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  resizeWindow: (scale) => ipcRenderer.send('resize-window', { scale }),
  savePosition: (x, y) => ipcRenderer.send('save-position', { x, y }),
  callAI: (config, messages) => ipcRenderer.invoke('call-ai', config, messages),
  quitApp: () => ipcRenderer.send('quit-app'),
  onSettingsChanged: (cb) => {
    ipcRenderer.on('settings-changed', (_, s) => cb(s));
  },
  onQuotesUpdated: (cb) => {
    ipcRenderer.on('quotes-updated', (_, q) => cb(q));
  }
});
