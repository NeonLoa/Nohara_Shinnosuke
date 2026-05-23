const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
const settingsFile = path.join(dataDir, 'settings.json');
const quotesFile = path.join(dataDir, 'quotes.json');
const defaultQuotesFile = path.join(dataDir, 'quotes.json');

let petWindow = null;
let tray = null;
let settingsWindow = null;

const defaultSettings = { scale: 1, speed: 1, bubbleDuration: 5000, opacity: 0.95 };

function readJSON(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return fallback; }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

function getQuotes() {
  if (fs.existsSync(quotesFile)) return readJSON(quotesFile, []);
  return readJSON(defaultQuotesFile, []);
}

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const settings = readJSON(settingsFile, defaultSettings);
  const s = Math.max(0.4, Math.min(3, settings.scale || 1));
  const baseW = 200, baseH = 260;
  const winW = Math.round(baseW * s);
  const winH = Math.round(baseH * s);

  const lastPos = settings.lastX != null ? { x: settings.lastX, y: settings.lastY }
    : { x: width - winW - 50, y: Math.round(height * 0.6) };

  petWindow = new BrowserWindow({
    width: winW, height: winH,
    x: lastPos.x, y: lastPos.y,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true);
  petWindow.loadFile('renderer/index.html');
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', '野原新之助.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('小新桌宠');

  const menu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => {
      if (petWindow) petWindow.isVisible() ? petWindow.hide() : petWindow.show();
    }},
    { label: '设置...', click: () => openSettingsWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480, height: 560,
    frame: true, resizable: false,
    title: '小新桌宠 - 设置',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile('renderer/settings.html');
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// IPC handlers
ipcMain.handle('get-settings', () => readJSON(settingsFile, defaultSettings));
ipcMain.handle('save-settings', (_, s) => {
  writeJSON(settingsFile, s);
  if (petWindow) {
    const scale = Math.max(0.4, Math.min(3, s.scale || 1));
    const [x, y] = petWindow.getPosition();
    petWindow.setSize(Math.round(200 * scale), Math.round(260 * scale));
    petWindow.setOpacity(s.opacity != null ? s.opacity : 0.95);
    petWindow.webContents.send('settings-changed', s);
  }
  if (settingsWindow) settingsWindow.webContents.send('settings-saved', s);
});

ipcMain.handle('get-quotes', () => getQuotes());
ipcMain.handle('save-quotes', (_, quotes) => {
  writeJSON(quotesFile, quotes);
  if (petWindow) petWindow.webContents.send('quotes-updated', quotes);
});

ipcMain.on('open-settings', () => openSettingsWindow());
ipcMain.on('move-window', (_, { x, y }) => {
  if (petWindow) petWindow.setPosition(Math.round(x), Math.round(y));
});
ipcMain.on('quit-app', () => app.quit());

// AI API call from main process (no CORS restrictions)
ipcMain.handle('call-ai', async (_, config, messages) => {
  const httpModule = config.baseUrl.startsWith('https') ? require('https') : require('http');
  const url = new URL(config.baseUrl.replace(/\/$/, '') + '/chat/completions');

  const body = JSON.stringify({
    model: config.model || 'deepseek-chat',
    messages,
    temperature: config.temperature || 0.8
  });

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  };
  if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers,
    timeout: 15000
  };

  return new Promise((resolve) => {
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.choices?.[0]?.message?.content?.trim() || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', (err) => {
      console.error('AI call error:', err.message);
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
});

ipcMain.on('resize-window', (_, { scale }) => {
  if (petWindow) {
    const s = Math.max(0.4, Math.min(3, scale));
    petWindow.setSize(Math.round(200 * s), Math.round(260 * s));
  }
});

// Save position on quit
ipcMain.on('save-position', (_, pos) => {
  const settings = readJSON(settingsFile, defaultSettings);
  settings.lastX = pos.x;
  settings.lastY = pos.y;
  writeJSON(settingsFile, settings);
});

app.whenReady().then(() => {
  createPetWindow();
  createTray();
});

app.on('window-all-closed', () => {}); // don't quit, tray stays
app.on('before-quit', () => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    const settings = readJSON(settingsFile, defaultSettings);
    settings.lastX = x;
    settings.lastY = y;
    writeJSON(settingsFile, settings);
  }
});
