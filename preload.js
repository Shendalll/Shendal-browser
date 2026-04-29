const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  // Window
  minimize:    () => ipcRenderer.invoke('window:minimize'),
  setThemeIcon:(t) => ipcRenderer.invoke('window:set-icon', t),
  cycleMode:   () => ipcRenderer.invoke('window:cycle-mode'),
  close:       () => ipcRenderer.invoke('window:close'),
  getMode:     () => ipcRenderer.invoke('window:get-mode'),

  // Session
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (d) => ipcRenderer.invoke('session:save', d),
  savedQuit:   () => ipcRenderer.invoke('session:saved-quit'),

  // Save
  savePage: (id) => ipcRenderer.invoke('save-page', id),

  // Extensions
  extGetAll:    () => ipcRenderer.invoke('ext:get-all'),
  extLoadFolder:() => ipcRenderer.invoke('ext:load-folder'),
  extOpenPopup: (id) => ipcRenderer.invoke('ext:open-popup', id),
  extRemove:    (id) => ipcRenderer.invoke('ext:remove', id),

  // Ad blocker
  adblockToggle: (v) => ipcRenderer.invoke('adblock:toggle', v),
  adblockStatus: () => ipcRenderer.invoke('adblock:status'),

  // Clear data
  clearData: () => ipcRenderer.invoke('clear-data'),

  // PiP
  pip: (id) => ipcRenderer.invoke('pip:enter', id),

  // Paths
  getPaths: () => ipcRenderer.invoke('get-paths'),

  // Events
  onShortcut:       (cb) => ipcRenderer.on('shortcut', (_, a) => cb(a)),
  onCursorPosition: (cb) => ipcRenderer.on('cursor-position', (_, p) => cb(p)),
  onOpenUrlNewTab:  (cb) => ipcRenderer.on('open-url-new-tab', (_, u) => cb(u)),
  onShowContextMenu:(cb) => ipcRenderer.on('show-context-menu', (_, d) => cb(d)),
  onSaveAndQuit:    (cb) => ipcRenderer.on('save-session-then-quit', () => cb()),
  onModeChanged:    (cb) => ipcRenderer.on('window-mode-changed', (_, m) => cb(m)),
});
