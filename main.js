// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
let mainWindow;

let FFMPEG, FFPROBE;

const PROCESSING_PLAN = {
    WFHD_SOURCE: [
        { format: 'WFHD', width: 1920, height: 1080, duration: 10, applyBar: true },
        { format: 'WIDE', width: 1280, height: 720, duration: 10, applyBar: true },
        { format: 'BOX',  width: 800,  height: 600, duration: 10, applyBar: false, letterbox: true },
        { format: 'TER',  width: 1280, height: 720, duration: 15, applyBar: false }
    ],
    BOX_SOURCE: [ { format: 'BOX', width: 800, height: 600, duration: 10, applyBar: true } ],
    MUP_SOURCE: [
        { format: 'VERT', width: 608,  height: 1080, duration: 10, applyBar: true },
        { format: 'VFHD', width: 1080, height: 1920, duration: 10, applyBar: true },
        { format: 'MUP',  width: 1080, height: 1920, duration: 10, applyBar: false }
    ],
    MUB_SOURCE: [
        { format: 'LED4', width: 864, height: 288, duration: 10, applyBar: false },
        { format: 'MUB', width: 2048, height: 720, duration: 10, applyBar: false }
    ],
    TOTEMG_SOURCE:[ { format: 'TOTEMG', width: 960, height: 1344, duration: 10, applyBar: false } ],
    WALL_SOURCE: [ { format: 'WALL', width: 1920, height: 540, duration: 10, applyBar: false } ],
    LED_SOURCE: [ { format: 'LED', width: 3360, height: 240, duration: 10, applyBar: false } ],
    SUPERLED_SOURCE: [ { format: 'SUPERLED', width: 3648, height: 1152, duration: 30, applyBar: false } ], 
};

const BAR_FILTERS = {
    VERT: '[0:v]scale=608:1005,pad=608:1080:0:0:color=black,setsar=1[out]',
    VFHD: '[0:v]scale=1080:1845,pad=1080:1920:0:0:color=black,setsar=1[out]',
    WIDE: '[0:v]scale=1280:645,pad=1280:720:0:0:color=black,setsar=1[out]',
    WFHD: '[0:v]scale=1920:1005,pad=1920:1080:0:0:color=black,setsar=1[out]',
    BOX:  '[0:v]scale=800:540,pad=800:600:0:0:color=black,setsar=1[out]',
};

async function getVideoInfo(filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
    const { stdout } = await execPromise(`${FFPROBE} -v quiet -print_format json -show_streams -show_format "${filePath}"`);
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

async function classifyInputFile(filePath, encoderConfig, workDir, filesToDelete) {
    const fileExt = path.extname(filePath).toLowerCase();
    let processedPath = filePath;
    let isTemp = false;

    if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
        const tempVideoPath = path.join(workDir, `${path.parse(filePath).name}_temp_image.mp4`);
        const cmd = `${FFMPEG} -loop 1 -i "${filePath}" -t 10 -vf "fps=30,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1" -c:v ${encoderConfig.codec} ${encoderConfig.quality} -y "${tempVideoPath}"`;
        await execPromise(cmd);
        processedPath = tempVideoPath;
        isTemp = true;
        filesToDelete.add(tempVideoPath);
    }

    const info = await getVideoInfo(processedPath);
    if (!info) return { type: 'UNKNOWN', path: filePath, isTemp: false, tempPath: null, info: null };

    const { width, height, duration } = info;
    const ratio = width / height;
    const segundos = Math.round(duration);

    let type = 'UNKNOWN';
    if ((segundos >= 8 && segundos <= 16) && Math.abs(ratio - (16/9)) < 0.25) type = 'WFHD_SOURCE';
    else if ((segundos >= 8 && segundos <= 15) && Math.abs(ratio - (4/3)) < 0.15) type = 'BOX_SOURCE';
    else if ((segundos >= 8 && segundos <= 15) && Math.abs(ratio - (9/16)) < 0.05) type = 'MUP_SOURCE';
    else if ((segundos >= 8 && segundos <= 15) && Math.abs(ratio - (2048/720)) < 0.1) type = 'MUB_SOURCE';
    else if ((segundos >= 8 && segundos <= 15) && Math.abs(ratio - (960/1344)) < 0.05) type = 'TOTEMG_SOURCE';
    else if ((segundos >= 8 && segundos <= 15) && Math.abs(ratio - (1920/540)) < 0.05) type = 'WALL_SOURCE';
    else if ((segundos >= 8 && segundos <= 15) && Math.abs(ratio - (3360/240)) < 0.05) type = 'LED_SOURCE';
    else if (segundos === 30 && width === 3648 && height === 1152) type = 'SUPERLED_SOURCE';

    return { type, path: filePath, isTemp, tempPath: isTemp ? processedPath : null, info };
}


const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 860,
        height: 640,
        frame: false,
        transparent: true,
        resizable: false,
        icon: path.join(__dirname, 'assets', os.platform() === 'win32' ? 'icon.ico' : 'icon.icns'), // Caminho do ícone atualizado
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.loadFile('index.html');
};

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
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
    
    const { videos: videoPaths, clientName } = data;
    const window = BrowserWindow.fromWebContents(event.sender);
    let fullLog = '';

    if (videoPaths.length === 0) return;

    const workDir = path.dirname(videoPaths[0]);
    const scriptTempDir = path.join(workDir, `.render-scripts-${Date.now()}`);
    const utilsDir = path.join(scriptTempDir, 'utils');
    const antigosDir = path.join(workDir, 'Antigos');
    const filesToDelete = new Set();

    const sendProgress = (videoPath, progress) => {
        window.webContents.send('progress-update', { videoPath, progress });
    };
    
    try {
        await fs.promises.mkdir(utilsDir, { recursive: true });
        await fs.promises.mkdir(antigosDir, { recursive: true });
        fullLog += `[MAIN] Ambiente de trabalho definido como: ${workDir}\n`;

        await fs.promises.copyFile(path.join(__dirname, 'scripts/rename.js'), path.join(scriptTempDir, 'rename.js'));
        const ffmpegUtilsPath = path.join(__dirname, 'scripts/ffmpegUtils.js');
        await fs.promises.copyFile(ffmpegUtilsPath, path.join(utilsDir, 'ffmpegUtils.js'));
        
        const ffmpegUtils = require(path.join(utilsDir, 'ffmpegUtils.js'));
        FFMPEG = ffmpegUtils.FFMPEG;
        FFPROBE = ffmpegUtils.FFPROBE;

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

        const classifiedFiles = [];
        for (const { originalPath, newSourcePath } of sourceFiles) {
            const classified = await classifyInputFile(newSourcePath, encoderConfig, workDir, filesToDelete);
            classifiedFiles.push({ ...classified, originalPath: originalPath });
        }
        const sourceTypesPresent = new Set(classifiedFiles.map(f => f.type).filter(t => t !== 'UNKNOWN'));

        for (const classifiedFile of classifiedFiles) {
            while (isPaused) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (isCancelled) {
                fullLog += '\n[MAIN] Processamento cancelado pelo usuário.\n';
                window.webContents.send('processing-cancelled', classifiedFile.originalPath);
                break;
            }

            const { type, tempPath, originalPath, info } = classifiedFile;
            const sourcePath = tempPath || classifiedFile.path;
            const originalBaseName = path.parse(sourcePath).name;
            const sourceDuration = info.duration;

            fullLog += `\n--- Processando: ${path.basename(originalPath)} ---\n`;
            window.webContents.send('processing-started', originalPath);
            sendProgress(originalPath, 0);

            let plan = PROCESSING_PLAN[type];
            if (!plan) {
                fullLog += `   - 🟡 Tipo de arquivo desconhecido. Pulando renderização.\n`;
                sendProgress(originalPath, 100);
                continue;
            }
            if (type === 'WFHD_SOURCE' && sourceTypesPresent.has('BOX_SOURCE')) {
                plan = plan.filter(output => output.format !== 'BOX');
            }
            
            let progress = 0;
            const progressStep = 100 / (plan.length || 1);

            for (const output of plan) {
                let outputPath;
                let filter;
                let isFilterComplex = false;

                let timeFilter = '';
                const targetDuration = output.duration;
                if (sourceDuration && targetDuration && Math.abs(sourceDuration - targetDuration) > 0.5) {
                    const ptsMultiplier = targetDuration / sourceDuration;
                    timeFilter = `,setpts=${ptsMultiplier.toFixed(4)}*PTS`;
                    fullLog += `     - Alterando velocidade do vídeo (duração de ${sourceDuration.toFixed(1)}s para ${targetDuration}s)\n`;
                }

                if (output.applyBar) {
                    outputPath = path.join(workDir, `${originalBaseName}_${output.format}_BAR.mp4`);
                    filter = BAR_FILTERS[output.format].replace('[out]', `${timeFilter}[out]`);
                    isFilterComplex = true;
                } else {
                    outputPath = path.join(workDir, `${originalBaseName}_${output.format}.mp4`);
                    if (output.letterbox) {
                        filter = `scale=${output.width}:${output.height}:force_original_aspect_ratio=decrease,pad=${output.width}:${output.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
                    } else {
                        filter = `scale=${output.width}:${output.height},setsar=1`;
                    }
                    filter += timeFilter;
                }
                
                let cmd;
                if (isFilterComplex) {
                    cmd = `${FFMPEG} -i "${sourcePath}" -filter_complex "${filter}" -map "[out]" -t ${output.duration} -c:v ${encoderConfig.codec} ${encoderConfig.quality} -an -y "${outputPath}"`;
                } else {
                    cmd = `${FFMPEG} -i "${sourcePath}" -vf "${filter}" -t ${output.duration} -c:v ${encoderConfig.codec} ${encoderConfig.quality} -an -y "${outputPath}"`;
                }

                try {
                    await execPromise(cmd);
                    fullLog += `     - Criado: ${path.basename(outputPath)}\n`;
                } catch (e) {
                    fullLog += `     - ❌ Falha ao gerar ${output.format}: ${e.message}\n`;
                }
                progress += progressStep;
                sendProgress(originalPath, progress);
            }
            sendProgress(originalPath, 100);
            window.webContents.send('processing-completed', originalPath);
            fullLog += `--- Concluído: ${path.basename(originalPath)} ---\n`;
        }

        if (!isCancelled) {
            fullLog += '\n--- A INICIAR SCRIPT DE RENOMEAÇÃO ---\n';
            const renameCommand = `node rename.js "${workDir}" "${clientName}"`;
            const renameLog = await execPromise(renameCommand, { cwd: scriptTempDir });
            fullLog += renameLog;
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

        fullLog += `\n✅ Processamento da fila concluído! Os ficheiros finais estão na pasta de origem e os originais foram arquivados.\n`;

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
