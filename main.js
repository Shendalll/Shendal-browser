const { app, BrowserWindow, ipcMain, screen, session, dialog, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let windowMode = 2; // 0=windowed, 1=maximized, 2=fullscreen
let isQuitting = false;

// ── Paths ────────────────────────────────────────────────────────
const userData = app.getPath('userData');
const sessionFile = path.join(userData, 'session.json');
const extDir = path.join(userData, 'Extensions');
const downloadsDir = path.join(userData, 'Downloads');
const cacheDir = path.join(userData, 'BrowserData');

// Downloads tracking
const activeDownloads = new Map();

[extDir, downloadsDir, cacheDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Built-in Ad Blocker ─────────────────────────────────────────
const AD_DOMAINS = [
  '*://*.doubleclick.net/*','*://*.googlesyndication.com/*','*://*.googleadservices.com/*',
  '*://*.google-analytics.com/*','*://*.googletagmanager.com/*','*://*.facebook.net/*/fbevents*',
  '*://*.adnxs.com/*','*://*.adsrvr.org/*','*://*.amazon-adsystem.com/*',
  '*://*.criteo.com/*','*://*.outbrain.com/*','*://*.taboola.com/*',
  '*://*.rubiconproject.com/*','*://*.pubmatic.com/*','*://*.casalemedia.com/*',
  '*://*.sharethis.com/*','*://*.addthis.com/*','*://*.quantserve.com/*',
  '*://*.scorecardresearch.com/*','*://*.zedo.com/*','*://*.admob.com/*',
  '*://*.moatads.com/*','*://*.serving-sys.com/*','*://*.popads.net/*',
  '*://*.popcash.net/*','*://*.revenuehits.com/*','*://*.mgid.com/*',
];
let adBlockEnabled = true;

function setupAdBlocker() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: AD_DOMAINS }, (details, callback) => {
    callback({ cancel: adBlockEnabled });
  });
}

// ── Extensions ──────────────────────────────────────────────────
async function loadExtensions() {
  const loaded = [];
  if (!fs.existsSync(extDir)) return loaded;
  const entries = fs.readdirSync(extDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(extDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const ext = await session.defaultSession.loadExtension(
        path.join(extDir, entry.name),
        { allowFileAccess: true }
      );
      loaded.push(ext);
    } catch (err) {
      console.error(`Extension load failed [${entry.name}]:`, err.message);
    }
  }
  return loaded;
}

function getExtensionInfo(ext) {
  const m = ext.manifest || {};
  const iconPath = (m.icons && (m.icons['48'] || m.icons['32'] || m.icons['16'] || m.icons['128'])) || '';
  return {
    id: ext.id,
    name: ext.name || m.name || 'Unknown',
    icon: iconPath ? `chrome-extension://${ext.id}/${iconPath}` : '',
    hasPopup: !!(m.action?.default_popup || m.browser_action?.default_popup),
    popupPage: m.action?.default_popup || m.browser_action?.default_popup || '',
  };
}

// ── Create Window ───────────────────────────────────────────────
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width, height,
    frame: false,
    fullscreen: true,
    resizable: true,
    backgroundColor: '#08080d',
    title: 'Shendal Browser',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.setMenu(null);

  // ── Downloads go to our folder ──
  session.defaultSession.on('will-download', (event, item) => {
    const savePath = path.join(downloadsDir, item.getFilename());
    item.setSavePath(savePath);
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    activeDownloads.set(id, item);
    
    const updateDownload = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('download-updated', {
        id,
        filename: item.getFilename(),
        state: item.getState(), // 'progressing', 'completed', 'cancelled', 'interrupted'
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
      });
    };
    
    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        updateDownload();
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          // paused
        } else {
          updateDownload();
        }
      }
    });
    
    item.once('done', (event, state) => {
      updateDownload();
      activeDownloads.delete(id);
    });
    
    updateDownload();
  });

  // ── Permissions ──
  session.defaultSession.setPermissionRequestHandler((_, perm, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);

  // ── Ad blocker ──
  setupAdBlocker();

  // ── Load Chrome Extensions ──
  loadExtensions().then(exts => {
    console.log(`Loaded ${exts.length} extension(s)`);
  });

  // ── web-contents-created ──
  app.on('web-contents-created', (_, contents) => {
    // Keyboard shortcuts
    contents.on('before-input-event', (event, input) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const ctrl = input.control, shift = input.shift;
      if (input.type !== 'keyDown') return;
      const isMain = contents.id === mainWindow.webContents.id;

      if (ctrl && !shift && input.key === 'ArrowRight') { event.preventDefault(); mainWindow.webContents.send('shortcut', 'next-tab'); }
      if (ctrl && !shift && input.key === 'ArrowLeft')  { event.preventDefault(); mainWindow.webContents.send('shortcut', 'prev-tab'); }
      if (ctrl && !shift && input.key === 'd' && !isMain) { event.preventDefault(); mainWindow.webContents.send('shortcut', 'next-tab'); }
      if (ctrl && !shift && input.key === 'a' && !isMain) { event.preventDefault(); mainWindow.webContents.send('shortcut', 'prev-tab'); }
      if (ctrl && !shift && input.key === 't')  { event.preventDefault(); mainWindow.webContents.send('shortcut', 'new-tab'); }
      if (ctrl && !shift && input.key === 'w')  { event.preventDefault(); mainWindow.webContents.send('shortcut', 'close-tab'); }
      if (ctrl && !shift && input.key === 'l')  { event.preventDefault(); mainWindow.webContents.send('shortcut', 'focus-search'); }
      if (ctrl && !shift && input.key === 'Tab') { event.preventDefault(); mainWindow.webContents.send('shortcut', 'quick-search'); }
      if (ctrl && shift && (input.key === 'H' || input.key === 'h')) { event.preventDefault(); mainWindow.webContents.send('shortcut', 'toggle-autohide'); }
      if (input.key === 'F11') {
        event.preventDefault();
        windowMode = (windowMode + 1) % 3;
        applyWindowMode();
        mainWindow.webContents.send('window-mode-changed', windowMode);
      }
    });

    // Context menu for webview content
    contents.on('context-menu', (event, params) => {
      event.preventDefault();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (contents.id === mainWindow.webContents.id) return;
      const cursor = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      mainWindow.webContents.send('show-context-menu', {
        x: cursor.x - bounds.x, y: cursor.y - bounds.y,
        linkURL: params.linkURL || '', srcURL: params.srcURL || '',
        pageURL: params.pageURL || '', selectionText: params.selectionText || '',
        mediaType: params.mediaType || '', webContentsId: contents.id,
      });
    });

    // Open links in new tab, not new window
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('open-url-new-tab', url);
      return { action: 'deny' };
    });
  });

  // ── Cursor tracking ──
  let mouseTrack = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) { clearInterval(mouseTrack); return; }
    const c = screen.getCursorScreenPoint(), b = mainWindow.getBounds();
    mainWindow.webContents.send('cursor-position', { x: c.x - b.x, y: c.y - b.y, winWidth: b.width, winHeight: b.height });
  }, 100);

  // ── Close → save session first ──
  mainWindow.on('close', e => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.webContents.send('save-session-then-quit');
    }
  });
  mainWindow.on('closed', () => { clearInterval(mouseTrack); mainWindow = null; });
}

function applyWindowMode() {
  if (!mainWindow) return;
  switch (windowMode) {
    case 0: mainWindow.setFullScreen(false); if(mainWindow.isMaximized()) mainWindow.unmaximize(); mainWindow.setSize(1200,800); mainWindow.center(); break;
    case 1: mainWindow.setFullScreen(false); mainWindow.maximize(); break;
    case 2: mainWindow.setFullScreen(true); break;
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── IPC ─────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:set-icon', (_, theme) => {
  if (!mainWindow) return;
  const iconName = theme === 'light' ? 'icon-white.png' : 'icon.png';
  mainWindow.setIcon(path.join(__dirname, 'assets', iconName));
});
ipcMain.handle('window:cycle-mode', () => {
  windowMode = (windowMode + 1) % 3;
  applyWindowMode();
  return windowMode;
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:get-mode', () => windowMode);

// Session
ipcMain.handle('session:load', async () => {
  try { if (fs.existsSync(sessionFile)) return JSON.parse(fs.readFileSync(sessionFile,'utf8')); } catch {}
  return null;
});
ipcMain.handle('session:save', async (_, data) => {
  try { fs.writeFileSync(sessionFile, JSON.stringify(data), 'utf8'); } catch(e) { console.error('Session save:',e); }
});
ipcMain.handle('session:saved-quit', () => { isQuitting = true; mainWindow?.close(); });

// Save page
ipcMain.handle('save-page', async (_, wcId) => {
  if (!mainWindow) return;
  const wc = webContents.fromId(wcId); if (!wc) return;
  const r = await dialog.showSaveDialog(mainWindow, { defaultPath:`${wc.getTitle()||'page'}.html`, filters:[{name:'Webpage',extensions:['html']},{name:'All',extensions:['*']}] });
  if (!r.canceled && r.filePath) { try { await wc.savePage(r.filePath,'HTMLComplete'); } catch(e) { console.error(e); } }
});

// Extensions
ipcMain.handle('ext:get-all', () => {
  return session.defaultSession.getAllExtensions().map(getExtensionInfo);
});
ipcMain.handle('ext:load-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties:['openDirectory'], title:'Select Extension Folder' });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const ext = await session.defaultSession.loadExtension(r.filePaths[0], { allowFileAccess:true });
    return getExtensionInfo(ext);
  } catch(e) { console.error('Ext load:',e); return null; }
});
ipcMain.handle('ext:open-popup', async (_, extId) => {
  const exts = session.defaultSession.getAllExtensions();
  const ext = exts.find(e => e.id === extId); if (!ext) return;
  const popup = ext.manifest.action?.default_popup || ext.manifest.browser_action?.default_popup;
  if (!popup) return;
  const pw = new BrowserWindow({ width:380, height:500, parent:mainWindow, frame:false, resizable:true, skipTaskbar:true, backgroundColor:'#1a1a2e' });
  pw.loadURL(`chrome-extension://${extId}/${popup}`);
  pw.on('blur', () => { try{pw.close();}catch{} });
});
ipcMain.handle('ext:remove', async (_, extId) => {
  try { await session.defaultSession.removeExtension(extId); return true; } catch { return false; }
});

// Ad blocker toggle
ipcMain.handle('adblock:toggle', (_, enabled) => { adBlockEnabled = enabled; return adBlockEnabled; });
ipcMain.handle('adblock:status', () => adBlockEnabled);

// Clear data
ipcMain.handle('clear-data', async () => {
  try { await session.defaultSession.clearStorageData(); await session.defaultSession.clearCache(); return true; } catch { return false; }
});

// PiP
ipcMain.handle('pip:enter', async (_, wcId) => {
  const wc = webContents.fromId(wcId); if(!wc) return false;
  try { await wc.executeJavaScript(`(()=>{const v=document.querySelector('video');if(v&&!document.pictureInPictureElement)v.requestPictureInPicture();else if(document.pictureInPictureElement)document.exitPictureInPicture();})()`); return true; } catch{return false;}
});

// Paths
ipcMain.handle('get-paths', () => ({
  userData, extDir, downloadsDir, cacheDir,
  uiDir: path.join(__dirname, 'ui'),
}));

// Downloads
ipcMain.handle('downloads:cancel', (_, id) => {
  const item = activeDownloads.get(id);
  if (item) {
    item.cancel();
    activeDownloads.delete(id);
  }
});

const { shell } = require('electron');
ipcMain.handle('downloads:open-folder', () => {
  shell.openPath(downloadsDir);
});
