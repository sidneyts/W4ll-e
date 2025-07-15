// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funções de Controle da Janela
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  getPlatform: () => process.platform,

  // Funções de Arquivo e Processamento
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  sendDroppedPaths: (paths) => ipcRenderer.send('paths-dropped', paths),
  startQueue: (data) => ipcRenderer.send('start-processing', data),
  
  // Funções de Controle da Fila
  pauseQueue: () => ipcRenderer.send('queue-pause'),
  resumeQueue: () => ipcRenderer.send('queue-resume'),
  cancelQueue: () => ipcRenderer.send('queue-cancel'),

  // Handlers para Receber Dados do Processo Principal
  handleFilesSelected: (callback) => ipcRenderer.on('files-selected', (event, ...args) => callback(...args)),
  handleProgressUpdate: (callback) => ipcRenderer.on('progress-update', (event, ...args) => callback(...args)),
  handleFinalLog: (callback) => ipcRenderer.on('final-log', (event, ...args) => callback(...args)),
  handleProcessingStarted: (callback) => ipcRenderer.on('processing-started', (event, ...args) => callback(...args)),
  handleProcessingCompleted: (callback) => ipcRenderer.on('processing-completed', (event, ...args) => callback(...args)),
  handleProcessingCancelled: (callback) => ipcRenderer.on('processing-cancelled', (event, ...args) => callback(...args)),
  handleProcessingError: (callback) => ipcRenderer.on('processing-error', (event, ...args) => callback(...args)),
  handleWindowFocusChange: (callback) => ipcRenderer.on('window-focus-change', (event, ...args) => callback(...args)),
  
  // Handlers para Modais Customizados
  handleShowAlert: (callback) => ipcRenderer.on('show-alert', (event, ...args) => callback(...args)),
  handleShowConfirm: (callback) => ipcRenderer.on('show-confirm', (event, ...args) => callback(...args)),
  sendConfirmResult: (actionId) => ipcRenderer.send('user-confirmed-action', actionId),

  // Funções de Invocação (Invoke/Handle)
  loadPresets: () => ipcRenderer.invoke('presets:load'),
  savePresets: (presets) => ipcRenderer.invoke('presets:save', presets),
  getVideoInfo: (filePath) => ipcRenderer.invoke('video:getInfo', filePath),
  getTranslations: (lng) => ipcRenderer.invoke('get-translations', lng),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', { key, value }),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  importPresets: () => ipcRenderer.invoke('presets:import'),
  exportPresets: () => ipcRenderer.invoke('presets:export'),

  // NOVO: Exposição da função de compatibilidade
  isPresetCompatible: (videoInfo, preset) => ipcRenderer.invoke('util:isPresetCompatible', { videoInfo, preset }),
});
