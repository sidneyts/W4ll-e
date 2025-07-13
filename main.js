// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const Store = require('electron-store');
const { i18next, initI18n } = require('./i18n');

const ffmpegUtils = require('./scripts/ffmpegUtils.js');

const execPromise = util.promisify(exec);
let mainWindow;

const store = new Store();

const { FFMPEG, FFPROBE } = ffmpegUtils;

autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

const presetsFilePath = path.join(app.getPath('userData'), 'presets.json');

function getDefaultPresets() {
    return [
        { id: 'WFHD', name: 'WIDEFULLHD', width: 1920, height: 1080, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
        { id: 'WIDE', name: 'WIDE', width: 1280, height: 720, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
        { id: 'TER', name: 'TER', width: 1280, height: 720, duration: 15, applyBar: false, letterbox: false, barSize: 0 },
        { id: 'BOX', name: 'BOX', width: 800, height: 600, duration: 10, applyBar: true, letterbox: false, barSize: 60 },
        { id: 'VFHD', name: 'VERTFULLHD', width: 1080, height: 1920, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
        { id: 'MUP', name: 'MUP', width: 1080, height: 1920, duration: 10, applyBar: false, letterbox: false, barSize: 0 },
        { id: 'VERT', name: 'VERT', width: 608, height: 1080, duration: 10, applyBar: true, letterbox: false, barSize: 75 },
    ];
}

ipcMain.handle('presets:load', async () => {
    try {
        if (fs.existsSync(presetsFilePath)) {
            const data = await fs.promises.readFile(presetsFilePath, 'utf-8');
            return JSON.parse(data);
        } else {
            const defaultPresets = getDefaultPresets();
            await fs.promises.writeFile(presetsFilePath, JSON.stringify(defaultPresets, null, 2));
            return defaultPresets;
        }
    } catch (error) {
        console.error("Failed to load presets:", error);
        return getDefaultPresets();
    }
});

ipcMain.on('presets:save', async (event, presets) => {
    try {
        await fs.promises.writeFile(presetsFilePath, JSON.stringify(presets, null, 2));
    } catch (error) {
        console.error("Failed to save presets:", error);
    }
});

async function getVideoInfo(filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
    const command = `${FFPROBE} -v quiet -print_format json -show_streams -show_format "${filePath}"`;
    const { stdout } = await execPromise(command);
    const info = JSON.parse(stdout);
    const stream = info.streams.find(s => s.codec_type === 'video');
    if (!stream) return null;
    const duration = info.format && info.format.duration ? parseFloat(info.format.duration) : 10.0;
    return { width: stream.width, height: stream.height, duration: duration };
  } catch (err) {
    console.error(`Erro ao obter informações de ${path.basename(filePath)}.`);
    return null;
  }
}

ipcMain.handle('video:getInfo', async (event, filePath) => {
    return await getVideoInfo(filePath);
});

function isPresetCompatible(videoInfo, preset) {
    if (!videoInfo) return false;
    const sourceRatio = videoInfo.width / videoInfo.height;
    const presetRatio = preset.width / preset.height;
    const ratioDiff = Math.abs(sourceRatio - presetRatio);
    const timeDiff = Math.abs(videoInfo.duration - preset.duration);
    return ratioDiff <= 0.2 && timeDiff <= 2;
}


const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 680,
        height: 640,
        frame: false,
        transparent: true,
        resizable: true,
        icon: path.join(__dirname, 'assets', os.platform() === 'win32' ? 'icon.ico' : 'icon.icns'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.loadFile('index.html');

    mainWindow.on('blur', () => {
        if (mainWindow) {
            mainWindow.webContents.send('window-focus-change', false);
        }
    });

    mainWindow.on('focus', () => {
        if (mainWindow) {
            mainWindow.webContents.send('window-focus-change', true);
        }
    });
};

app.whenReady().then(async () => {
    await initI18n();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

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
  }).then((buttonIndex) => {
    if (buttonIndex.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

ipcMain.handle('get-translations', (event, lng) => {
    const language = lng || i18next.language;
    return i18next.getResourceBundle(language, 'translation');
});

// IPC para Configurações
ipcMain.handle('get-setting', (event, key) => {
    return store.get(key);
});

ipcMain.on('set-setting', (event, { key, value }) => {
    store.set(key, value);
    if (key === 'language') {
        i18next.changeLanguage(value).then(() => {
            mainWindow.webContents.reload();
        });
    }
});


ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.on('window-close', () => mainWindow.close());
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Vídeos e Imagens', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'jpg', 'jpeg', 'png'] }]
    }).then(result => {
        if (!result.canceled) {
            event.sender.send('files-selected', result.filePaths);
        }
    });
});

let isPaused = false;
let isCancelled = false;

ipcMain.on('queue-pause', () => { isPaused = true; });
ipcMain.on('queue-resume', () => { isPaused = false; });
ipcMain.on('queue-cancel', () => { 
    isCancelled = true;
    isPaused = false;
});

ipcMain.on('start-processing', async (event, data) => {
    isPaused = false;
    isCancelled = false;
    
    const { videos: videoPaths, clientName, selectedPresets } = data;
    const window = BrowserWindow.fromWebContents(event.sender);
    let fullLog = '';

    if (videoPaths.length === 0 || selectedPresets.length === 0) {
        window.webContents.send('final-log', 'Nenhum vídeo ou preset selecionado.');
        return;
    }

    const workDir = path.dirname(videoPaths[0]);
    const scriptTempDir = path.join(workDir, `.render-scripts-${Date.now()}`);
    const antigosDir = path.join(workDir, 'Antigos');
    const filesToDelete = new Set();

    const sendProgress = (videoPath, progress) => {
        window.webContents.send('progress-update', { videoPath, progress });
    };
    
    try {
        await fs.promises.mkdir(scriptTempDir, { recursive: true });
        await fs.promises.mkdir(antigosDir, { recursive: true });
        fullLog += `[MAIN] Ambiente de trabalho definido como: ${workDir}\n`;

        await fs.promises.copyFile(path.join(app.getAppPath(), 'scripts/rename.js'), path.join(scriptTempDir, 'rename.js'));
        
        fullLog += '\n--- ARQUIVANDO ARQUIVOS ORIGINAIS ---\n';
        const sourceFiles = [];
        for (const originalPath of videoPaths) {
            const fileName = path.basename(originalPath);
            const newSourcePath = path.join(antigosDir, fileName);
            await fs.promises.rename(originalPath, newSourcePath);
            sourceFiles.push({ originalPath, newSourcePath });
            fullLog += `   - MOVENDO: ${fileName} para a pasta "Antigos".\n`;
        }

        const encoderConfig = { codec: 'libx264', quality: '-preset fast -crf 25' };
        fullLog += `[MAIN] Usando encoder padrão: ${encoderConfig.codec}\n`;

        for (const sourceFile of sourceFiles) {
            const { originalPath, newSourcePath } = sourceFile;

            window.webContents.send('processing-started', originalPath);
            sendProgress(originalPath, 0);

            let tempImagePath = null;
            let sourceForProcessing = newSourcePath;

            const fileExt = path.extname(newSourcePath).toLowerCase();
            if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
                tempImagePath = path.join(workDir, `${path.parse(newSourcePath).name}_temp_image.mp4`);
                const cmd = `${FFMPEG} -loop 1 -i "${newSourcePath}" -t 10 -vf "fps=30,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1" -c:v ${encoderConfig.codec} ${encoderConfig.quality} -y "${tempImagePath}"`;
                await execPromise(cmd);
                sourceForProcessing = tempImagePath;
                filesToDelete.add(tempImagePath);
            }

            const videoInfo = await getVideoInfo(sourceForProcessing);
            if (!videoInfo) {
                const errorMsg = `Não foi possível analisar as informações do vídeo. O arquivo pode estar corrompido ou não ser um vídeo válido.`;
                fullLog += `\n--- ⚠️  Aviso: Pulando ${path.basename(originalPath)} ---\n   - MOTIVO: ${errorMsg}\n`;
                window.webContents.send('processing-error', { videoPath: originalPath, error: errorMsg });
                continue;
            }
            
            const { duration: sourceDuration } = videoInfo;
            const processingErrors = [];
            
            for (const preset of selectedPresets) {
                while (isPaused) { await new Promise(resolve => setTimeout(resolve, 500)); }
                if (isCancelled) break;

                if (!isPresetCompatible(videoInfo, preset)) {
                    fullLog += `   - ℹ️ Pulando preset '${preset.name}' por ser incompatível com '${path.basename(sourceForProcessing)}'.\n`;
                    continue;
                }

                const originalBaseName = path.parse(sourceForProcessing).name;
                const outputPath = path.join(workDir, `${originalBaseName}_${preset.name}.mp4`);

                let timeFilter = '';
                if (sourceDuration && preset.duration && Math.abs(sourceDuration - preset.duration) > 0.5) {
                    const ptsMultiplier = preset.duration / sourceDuration;
                    timeFilter = `,setpts=${ptsMultiplier.toFixed(4)}*PTS`;
                }
                
                let filter;
                if (preset.letterbox) {
                    filter = `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1${timeFilter}`;
                } else if (preset.applyBar) {
                    const barSize = preset.barSize || 0;
                    const contentHeight = preset.height - barSize;
                    const paddingY = Math.floor(barSize / 2);
                    filter = `scale=${preset.width}:${contentHeight},pad=${preset.width}:${preset.height}:0:0:color=black,setsar=1${timeFilter}`;
                } else {
                    filter = `scale=${preset.width}:${preset.height},setsar=1${timeFilter}`;
                }

                const cmd = `${FFMPEG} -i "${sourceForProcessing}" -vf "${filter}" -t ${preset.duration} -c:v ${encoderConfig.codec} ${encoderConfig.quality} -an -y "${outputPath}"`;

                try {
                    await execPromise(cmd);
                    fullLog += `     - Criado: ${path.basename(outputPath)}\n`;
                } catch (e) {
                    const errorMessage = `Falha ao gerar ${preset.name}: ${e.message}`;
                    fullLog += `     - ❌ ${errorMessage}\n`;
                    processingErrors.push(errorMessage);
                }
            }
            
            if (isCancelled) {
                fullLog += '\n[MAIN] Processamento cancelado pelo usuário.\n';
                window.webContents.send('processing-cancelled', originalPath);
                break;
            }

            if (processingErrors.length > 0) {
                window.webContents.send('processing-error', { videoPath: originalPath, error: processingErrors.join('\n') });
            } else {
                window.webContents.send('processing-completed', originalPath);
            }
            fullLog += `--- Concluído: ${path.basename(originalPath)} ---\n`;
        }

        if (!isCancelled) {
            fullLog += '\n--- A INICIAR SCRIPT DE RENOMEAÇÃO ---\n';
            const renameCommand = `node rename.js "${workDir}" "${clientName}" "${ffmpegUtils.ffmpegPath}"`;
            const { stdout, stderr } = await execPromise(renameCommand, { cwd: scriptTempDir });
            fullLog += stdout;
            if (stderr) fullLog += `\n[RENAME SCRIPT STDERR]:\n${stderr}\n`;
            fullLog += '--- SCRIPT DE RENOMEAÇÃO CONCLUÍDO ---\n';
        }

        fullLog += '\n--- LIMPANDO ARQUIVOS TEMPORÁRIOS ---\n';
        for (const fileToDelete of filesToDelete) {
            try {
                if (fs.existsSync(fileToDelete)) {
                    await fs.promises.unlink(fileToDelete);
                    fullLog += `   - EXCLUINDO: Arquivo intermediário ${path.basename(fileToDelete)}.\n`;
                }
            } catch (e) {
                fullLog += `   - ⚠️ Falha ao excluir ${path.basename(fileToDelete)}.\n`;
            }
        }

        fullLog += `\n✅ Processamento da fila concluído!\n`;

    } catch (error) {
        fullLog += `\n❌ ERRO GERAL: Ocorreu uma falha.\n${error.stack}\n`;
    } finally {
        if (fs.existsSync(scriptTempDir)) {
            await fs.promises.rm(scriptTempDir, { recursive: true, force: true });
            fullLog += `[MAIN] Scripts temporários removidos.\n`;
        }
        window.webContents.send('final-log', fullLog);
    }
});
