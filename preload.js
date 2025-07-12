// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funções de controle da janela
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  getPlatform: () => process.platform, // Expõe a plataforma (win32, darwin, etc)

  // Funções de arquivo e processamento
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  startQueue: (data) => ipcRenderer.send('start-processing', data),
  
  // Funções de controle da fila
  pauseQueue: () => ipcRenderer.send('queue-pause'),
  resumeQueue: () => ipcRenderer.send('queue-resume'),
  cancelQueue: () => ipcRenderer.send('queue-cancel'),

  // Handlers para receber dados do processo principal
  handleFilesSelected: (callback) => ipcRenderer.on('files-selected', callback),
  handleProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),
  handleFinalLog: (callback) => ipcRenderer.on('final-log', callback),
  handleProcessingStarted: (callback) => ipcRenderer.on('processing-started', callback),
  handleProcessingCompleted: (callback) => ipcRenderer.on('processing-completed', callback),
  handleProcessingCancelled: (callback) => ipcRenderer.on('processing-cancelled', callback),
});
