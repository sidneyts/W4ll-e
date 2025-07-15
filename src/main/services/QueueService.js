// src/main/services/QueueService.js
const path = require('path');
const PQueue = require('p-queue').default;
const FileService = require('./FileService');
const FfmpegService = require('./FfmpegService');
const RenameService = require('./RenameService');
const { isPresetCompatible } = require('../../shared/compatibility');

// --- Configuração da Fila ---
const queue = new PQueue({ concurrency: 2 });

let mainWindow = null;
let fullLog = '';

// --- Funções de Controle ---

function pause() {
    queue.pause();
    appendToLog('[FILA] Processamento pausado pelo usuário.');
}

function resume() {
    queue.start();
    appendToLog('[FILA] Processamento retomado pelo usuário.');
}

function cancel() {
    queue.clear();
    appendToLog('[FILA] Processamento cancelado pelo usuário.');
    if (mainWindow) {
        mainWindow.webContents.send('processing-cancelled');
        mainWindow.webContents.send('final-log', fullLog);
    }
}

function appendToLog(message) {
    console.log(message);
    fullLog += message + '\n';
}

/**
 * Inicia o processamento da fila de vídeos.
 * @param {object} data - Dados recebidos da UI.
 * @param {BrowserWindow} win - A instância da janela principal.
 */
async function start(data, win) {
    mainWindow = win;
    fullLog = '';
    const { videos, clientName, selectedPresets, encoderSettings } = data;

    if (videos.length === 0 || selectedPresets.length === 0) {
        appendToLog('[FILA] Nenhum vídeo ou preset selecionado.');
        mainWindow.webContents.send('final-log', fullLog);
        return;
    }

    appendToLog('[FILA] Iniciando processamento...');
    appendToLog(`   - Configurações de Codificação: Preset=${encoderSettings.encoderPreset}, CRF=${encoderSettings.qualityFactor}`);


    for (const video of videos) {
        queue.add(() => processVideo(video, { clientName, selectedPresets, encoderSettings }));
    }

    await queue.onIdle();
    appendToLog('\n[FILA] ✅ Processamento da fila concluído!');
    
    if (mainWindow) {
        mainWindow.webContents.send('final-log', fullLog);
    }
}

/**
 * Processa um único vídeo, movendo-o, renderizando para cada preset e renomeando.
 * @param {object} video - O objeto do vídeo da fila.
 * @param {object} options - Opções de processamento { clientName, selectedPresets, encoderSettings }.
 */
async function processVideo(video, { clientName, selectedPresets, encoderSettings }) {
    mainWindow.webContents.send('processing-started', video.path);
    appendToLog(`\n--- INICIANDO: ${path.basename(video.path)} ---`);

    const workDir = path.dirname(video.path);
    const antigosDir = path.join(workDir, 'Antigos');
    const tempDir = path.join(workDir, `.w4lle-temp-${Date.now()}`);
    const filesToDelete = new Set();
    let hasSuccessfulRender = false;

    try {
        await FileService.ensureDirExists(antigosDir);
        await FileService.ensureDirExists(tempDir);

        const sourceFileName = path.basename(video.path);
        let sourceForProcessing = video.path;
        const fileExt = path.extname(video.path).toLowerCase();

        if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
            const tempVideoPath = path.join(tempDir, `${path.parse(sourceFileName).name}_temp.mp4`);
            filesToDelete.add(tempVideoPath);
            appendToLog(`   - CONVERTENDO IMAGEM: Criando vídeo temporário de 10s.`);
            await FfmpegService.renderVideo({
                inputPath: video.path,
                outputPath: tempVideoPath,
                preset: { width: video.info.width, height: video.info.height, duration: 10, useOriginalDuration: false },
                encoderSettings: { encoderPreset: 'fast', qualityFactor: 23 }, // Usa um padrão para conversão de imagem
                onProgress: () => {},
            });
            sourceForProcessing = tempVideoPath;
            video.info.duration = 10.0;
        }

        let presetsRendered = 0;
        for (const preset of selectedPresets) {
            if (!isPresetCompatible(video.info, preset)) {
                appendToLog(`     - ℹ️ PULANDO PRESET (incompatível): ${preset.name}`);
                continue;
            }
            
            presetsRendered++;
            const tempOutputPath = path.join(workDir, `${path.parse(sourceFileName).name}_${preset.name}_temp.mp4`);
            
            preset.sourceDuration = video.info.duration;

            const finalClientName = clientName.trim() || path.parse(sourceFileName).name;

            appendToLog(`     - RENDERIZANDO PRESET: ${preset.name}`);
            await FfmpegService.renderVideo({
                inputPath: sourceForProcessing,
                outputPath: tempOutputPath,
                preset: preset,
                encoderSettings: encoderSettings, // Passa as configurações para o FfmpegService
                onProgress: (progress) => {
                    mainWindow.webContents.send('progress-update', { videoPath: video.path, progress });
                },
            });

            hasSuccessfulRender = true;

            const finalName = await RenameService.renameOutputFile(tempOutputPath, preset, finalClientName);
            appendToLog(`       - RENOMEADO PARA: ${finalName}`);
        }

        if (presetsRendered === 0) {
             appendToLog(`   - ⚠️ AVISO: Nenhum preset compatível foi encontrado para este arquivo.`);
        }
        
        if (hasSuccessfulRender && !['.jpg', '.jpeg', '.png'].includes(fileExt)) {
            const newSourcePath = path.join(antigosDir, sourceFileName);
            await FileService.moveFile(video.path, newSourcePath);
            appendToLog(`   - MOVENDO ORIGINAL: ${sourceFileName} para a pasta "Antigos".`);
        } else if (hasSuccessfulRender) {
             appendToLog(`   - MANTENDO IMAGEM ORIGINAL: ${sourceFileName}.`);
        }


        mainWindow.webContents.send('processing-completed', video.path);
        appendToLog(`--- CONCLUÍDO: ${path.basename(video.path)} ---`);

    } catch (error) {
        appendToLog(`   - ❌ ERRO ao processar ${path.basename(video.path)}: ${error.message}`);
        mainWindow.webContents.send('processing-error', { videoPath: video.path, error: error.message });
    } finally {
        for (const file of filesToDelete) {
            await FileService.removeItem(file);
        }
        await FileService.removeItem(tempDir);
    }
}

module.exports = {
    start,
    pause,
    resume,
    cancel,
};
