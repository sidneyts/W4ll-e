// src/main/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { i18next, initI18n } = require('./i18n');
const QueueService = require('./services/QueueService');
const FfmpegService = require('./services/FfmpegService');
const { isPresetCompatible } = require('../shared/compatibility'); // Importa a lógica compartilhada

app.commandLine.appendSwitch('remote-debugging-port', '9222');

const store = new Store({
    // Define valores padrão para as novas configurações
    defaults: {
        language: 'pt',
        encoderPreset: 'fast',
        qualityFactor: 25
    }
});

let mainWindow;

autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 680,
        height: 720, // Aumentei a altura para acomodar as novas configurações
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
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        autoUpdater.checkForUpdatesAndNotify();
    });

    mainWindow.on('blur', () => mainWindow.webContents.send('window-focus-change', false));
    mainWindow.on('focus', () => mainWindow.webContents.send('window-focus-change', true));
}

app.whenReady().then(async () => {
    await initI18n();
    createWindow();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- Handlers de Comunicação IPC ---

ipcMain.on('window-close', () => mainWindow.close());
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});

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

ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'openDirectory', 'multiSelections'],
        filters: [{ name: 'Vídeos e Imagens', extensions: ['mp4', '.mov', '.mkv', '.avi', '.webm', '.jpg', '.jpeg', '.png'] }]
    }).then(async result => {
        if (!result.canceled && result.filePaths.length > 0) {
            const expandedFiles = await expandPathsToFiles(result.filePaths);
            mainWindow.webContents.send('files-selected', expandedFiles);
        }
    });
});

ipcMain.on('paths-dropped', async (event, paths) => {
    const expandedFiles = await expandPathsToFiles(paths);
    mainWindow.webContents.send('files-selected', expandedFiles);
});

ipcMain.on('start-processing', (event, data) => {
    // Busca as configurações de codificação antes de iniciar a fila
    const encoderSettings = {
        encoderPreset: store.get('encoderPreset'),
        qualityFactor: store.get('qualityFactor')
    };
    QueueService.start({ ...data, encoderSettings }, mainWindow);
});
ipcMain.on('queue-pause', () => QueueService.pause());
ipcMain.on('queue-resume', () => QueueService.resume());
ipcMain.on('queue-cancel', () => QueueService.cancel());

// --- Gerenciamento de Presets ---
const userPresetsPath = path.join(app.getPath('userData'), 'presets.json');

ipcMain.handle('presets:load', async () => {  
    try {
        if (fs.existsSync(userPresetsPath)) {
            const data = await fs.promises.readFile(userPresetsPath, 'utf-8');
            return JSON.parse(data);
        } else {
            const defaultPresetsPath = path.join(app.getAppPath(), 'presets.json');
            const defaultData = await fs.promises.readFile(defaultPresetsPath, 'utf-8');
            const defaultPresets = JSON.parse(defaultData);
            await fs.promises.writeFile(userPresetsPath, JSON.stringify(defaultPresets, null, 2));
            return defaultPresets;
        }
    } catch (error) {
        console.error("Falha ao carregar os presets:", error);
        return [];
    }
});

ipcMain.handle('presets:save', async (event, presets) => {
    try {
        await fs.promises.writeFile(userPresetsPath, JSON.stringify(presets, null, 2));
    } catch (error) {
        console.error("Falha ao guardar os presets:", error);
    }
});

ipcMain.handle('presets:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importar Predefinições',
        buttonLabel: 'Importar',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
        return { success: false, messageKey: 'importCancelled' };
    }

    try {
        const filePath = filePaths[0];
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        JSON.parse(fileContent);
        
        await fs.promises.writeFile(userPresetsPath, fileContent);
        
        mainWindow.webContents.reload();
        return { success: true };
    } catch (error) {
        console.error('Falha ao importar predefinições:', error);
        return { success: false, messageKey: 'importErrorInvalidFile' };
    }
});

ipcMain.handle('presets:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar Predefinições',
        buttonLabel: 'Exportar',
        defaultPath: 'presets.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (canceled || !filePath) {
        return { success: false, messageKey: 'exportCancelled' };
    }

    try {
        const currentPresets = await fs.promises.readFile(userPresetsPath, 'utf-8');
        await fs.promises.writeFile(filePath, currentPresets);
        return { success: true };
    } catch (error) {
        console.error('Falha ao exportar predefinições:', error);
        return { success: false, messageKey: 'exportError' };
    }
});

// --- Handlers de Serviços e Utilitários ---
ipcMain.handle('video:getInfo', (event, filePath) => {
    return FfmpegService.getVideoInfo(filePath);
});

ipcMain.handle('util:isPresetCompatible', (event, { videoInfo, preset }) => {
    return isPresetCompatible(videoInfo, preset);
});

ipcMain.handle('get-translations', (event, lng) => i18next.getResourceBundle(lng || i18next.language, 'translation'));

ipcMain.handle('get-setting', (event, key) => store.get(key));

ipcMain.handle('set-setting', (event, { key, value }) => {
    store.set(key, value);
    if (key === 'language') {
        i18next.changeLanguage(value).then(() => {
            // Recarrega a UI para aplicar o novo idioma em todos os lugares
            mainWindow.webContents.reload();
        });
    }
});

// --- Lógica de Atualização Automática ---
ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify());

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('show-alert', { messageKey: 'updateAvailable' });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('show-confirm', {
    messageKey: 'updateReady',
    confirmKey: 'restart',
    cancelKey: 'later'
  }, 'update-and-restart'); 
});

ipcMain.on('user-confirmed-action', (event, actionId) => {
    if (actionId === 'update-and-restart') {
        autoUpdater.quitAndInstall();
    }
});
