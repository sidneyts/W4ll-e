// src/main/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { i18next, initI18n } = require('./i18n');
const QueueService = require('./services/QueueService');

// Habilita a porta de depuração para o processo de renderização
app.commandLine.appendSwitch('remote-debugging-port', '9222');

// Inicializa o armazenamento de configurações
const store = new Store();

// --- Variáveis Globais ---
let mainWindow;

// --- Configuração do Auto-Updater ---
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

// --- Funções da Janela Principal ---

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 680,
        height: 640,
        frame: false,
        transparent: true,
        resizable: true,
        icon: path.join(__dirname, '../assets', process.platform === 'win32' ? 'icon.ico' : 'icon.icns'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.on('blur', () => mainWindow.webContents.send('window-focus-change', false));
    mainWindow.on('focus', () => mainWindow.webContents.send('window-focus-change', true));
}

// --- Ciclo de Vida do Aplicativo ---

app.whenReady().then(async () => {
    await initI18n();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- Handlers de Comunicação IPC ---

// Controle da Janela
ipcMain.on('window-close', () => mainWindow.close());
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});

/**
 * Função auxiliar para expandir caminhos de pastas em uma lista de arquivos válidos.
 */
async function expandPathsToFiles(paths) {
    const allFiles = [];
    const allowedExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.jpg', '.jpeg', '.png'];

    for (const filePath of paths) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                const filesInDir = await fs.promises.readdir(filePath);
                for (const file of filesInDir) {
                    const fullPath = path.join(filePath, file);
                    if (allowedExtensions.includes(path.extname(fullPath).toLowerCase())) {
                        allFiles.push(fullPath);
                    }
                }
            } else if (allowedExtensions.includes(path.extname(filePath).toLowerCase())) {
                allFiles.push(filePath);
            }
        } catch (error) {
            console.error(`Falha ao processar o caminho: ${filePath}`, error);
        }
    }
    return allFiles;
}

// Abertura de Arquivos (Botão Importar)
ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'openDirectory', 'multiSelections'],
        filters: [{ name: 'Vídeos e Imagens', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'jpg', 'jpeg', 'png'] }]
    }).then(async result => {
        if (!result.canceled && result.filePaths.length > 0) {
            const expandedFiles = await expandPathsToFiles(result.filePaths);
            mainWindow.webContents.send('files-selected', expandedFiles);
        }
    });
});

// Arquivos arrastados (Drag-and-Drop)
ipcMain.on('paths-dropped', async (event, paths) => {
    const expandedFiles = await expandPathsToFiles(paths);
    mainWindow.webContents.send('files-selected', expandedFiles);
});

// Processamento da Fila
ipcMain.on('start-processing', (event, data) => QueueService.start(data, mainWindow));
ipcMain.on('queue-pause', () => QueueService.pause());
ipcMain.on('queue-resume', () => QueueService.resume());
ipcMain.on('queue-cancel', () => QueueService.cancel());

// Gerenciamento de Presets
const presetsFilePath = path.join(app.getPath('userData'), 'presets.json');
const defaultPresets = [
    { id: 'WFHD', name: 'WIDEFULLHD', width: 1920, height: 1080, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
    { id: 'WIDE', name: 'WIDE', width: 1280, height: 720, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
    { id: 'VFHD', name: 'VERTFULLHD', width: 1080, height: 1920, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
];

ipcMain.handle('presets:load', async () => {
    try {
        if (fs.existsSync(presetsFilePath)) {
            return JSON.parse(await fs.promises.readFile(presetsFilePath, 'utf-8'));
        } else {
            await fs.promises.writeFile(presetsFilePath, JSON.stringify(defaultPresets, null, 2));
            return defaultPresets;
        }
    } catch (error) {
        console.error("Failed to load presets:", error);
        return defaultPresets;
    }
});

ipcMain.handle('presets:save', async (event, presets) => {
    try {
        await fs.promises.writeFile(presetsFilePath, JSON.stringify(presets, null, 2));
    } catch (error) {
        console.error("Failed to save presets:", error);
    }
});

// Informações de Vídeo
ipcMain.handle('video:getInfo', (event, filePath) => {
    const FfmpegService = require('./services/FfmpegService');
    return FfmpegService.getVideoInfo(filePath);
});

// Configurações e Traduções
ipcMain.handle('get-translations', (event, lng) => i18next.getResourceBundle(lng || i18next.language, 'translation'));
ipcMain.handle('get-setting', (event, key) => store.get(key));
ipcMain.handle('set-setting', (event, { key, value }) => {
    store.set(key, value);
    if (key === 'language') {
        i18next.changeLanguage(value).then(() => mainWindow.webContents.reload());
    }
});

// Atualizações
ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify());

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização Encontrada',
    message: 'Uma nova versão do W4ll-E está disponível. O download começará em segundo plano.'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização Pronta',
    message: 'A nova versão foi baixada. Reinicie o aplicativo para aplicar as atualizações.',
    buttons: ['Reiniciar', 'Mais tarde']
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});
