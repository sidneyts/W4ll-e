// src/main/services/QueueService.js
const path = require('path');
const PQueue = require('p-queue').default;
const FileService = require('./FileService');
const FfmpegService = require('./FfmpegService');
const RenameService = require('./RenameService');

// --- Configuração da Fila ---
// Limita a 2 processos ffmpeg simultâneos para não sobrecarregar a CPU.
const queue = new PQueue({ concurrency: 2 });

let mainWindow = null; // Referência à janela principal para enviar eventos
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
    queue.clear(); // Limpa todas as tarefas pendentes
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

// --- Lógica de Compatibilidade ---
/**
 * Verifica se um preset é compatível com as informações de um vídeo.
 * A tolerância é de 20% para a proporção e 2 segundos para a duração.
 * @param {object} videoInfo - Informações do vídeo de origem { width, height, duration }.
 * @param {object} preset - O objeto do preset.
 * @returns {boolean} - Retorna true se for compatível.
 */
function isPresetCompatible(videoInfo, preset) {
    if (!videoInfo) return false;
    const sourceRatio = videoInfo.width / videoInfo.height;
    const presetRatio = preset.width / preset.height;
    const ratioDiff = Math.abs(sourceRatio - presetRatio);
    const timeDiff = Math.abs(videoInfo.duration - preset.duration);

    // Tolerância de 20% para proporção e 2s para duração
    return ratioDiff <= 0.2 && timeDiff <= 2;
}

/**
 * Inicia o processamento da fila de vídeos.
 * @param {object} data - Dados recebidos da UI.
 * @param {BrowserWindow} win - A instância da janela principal.
 */
async function start(data, win) {
    mainWindow = win;
    fullLog = ''; // Reseta o log a cada nova fila
    const { videos, clientName, selectedPresets } = data;

    if (videos.length === 0 || selectedPresets.length === 0) {
        appendToLog('[FILA] Nenhum vídeo ou preset selecionado.');
        mainWindow.webContents.send('final-log', fullLog);
        return;
    }

    const workDir = path.dirname(videos[0].path);
    const antigosDir = path.join(workDir, 'Antigos');
    const tempDir = path.join(workDir, `.w4lle-temp-${Date.now()}`);
    const filesToDelete = new Set();

    try {
        await FileService.ensureDirExists(antigosDir);
        await FileService.ensureDirExists(tempDir);
        appendToLog(`[FILA] Ambiente de trabalho definido como: ${workDir}`);

        // Adiciona cada vídeo à fila de processamento
        for (const video of videos) {
            queue.add(() => processVideo(video, { antigosDir, tempDir, workDir, clientName, selectedPresets, filesToDelete }));
        }

        // Quando a fila estiver vazia, finaliza o processo
        await queue.onIdle();
        appendToLog('\n[FILA] ✅ Processamento da fila concluído!');

    } catch (error) {
        appendToLog(`\n[FILA] ❌ ERRO GERAL: Ocorreu uma falha crítica.\n${error.stack}`);
    } finally {
        appendToLog('\n--- LIMPANDO ARQUIVOS TEMPORÁRIOS ---');
        for (const file of filesToDelete) {
            await FileService.removeItem(file);
            appendToLog(`   - EXCLUINDO: ${path.basename(file)}`);
        }
        await FileService.removeItem(tempDir);
        appendToLog(`   - EXCLUINDO PASTA TEMPORÁRIA: ${path.basename(tempDir)}`);
        
        if (mainWindow) {
            mainWindow.webContents.send('final-log', fullLog);
        }
    }
}

/**
 * Processa um único vídeo, movendo-o, renderizando para cada preset e renomeando.
 * @param {object} video - O objeto do vídeo da fila.
 * @param {object} paths - Objeto com os caminhos necessários.
 */
async function processVideo(video, { antigosDir, tempDir, workDir, clientName, selectedPresets, filesToDelete }) {
    mainWindow.webContents.send('processing-started', video.path);
    appendToLog(`\n--- INICIANDO: ${path.basename(video.path)} ---`);

    try {
        // 1. Mover arquivo original
        const sourceFileName = path.basename(video.path);
        const newSourcePath = path.join(antigosDir, sourceFileName);
        await FileService.moveFile(video.path, newSourcePath);
        appendToLog(`   - MOVENDO: ${sourceFileName} para a pasta "Antigos".`);

        let sourceForProcessing = newSourcePath;
        const fileExt = path.extname(newSourcePath).toLowerCase();

        // 2. Se for imagem, cria um vídeo temporário
        if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
            const tempVideoPath = path.join(tempDir, `${path.parse(sourceFileName).name}_temp.mp4`);
            filesToDelete.add(tempVideoPath);
            appendToLog(`   - CONVERTENDO IMAGEM: Criando vídeo temporário de 10s.`);
            await FfmpegService.renderVideo({
                inputPath: newSourcePath,
                outputPath: tempVideoPath,
                preset: { width: video.info.width, height: video.info.height, duration: 10 },
                onProgress: () => {},
            });
            sourceForProcessing = tempVideoPath;
            video.info.duration = 10.0;
        }

        // 3. Renderiza para cada preset selecionado
        let presetsRendered = 0;
        for (const preset of selectedPresets) {
            // CORREÇÃO: Verifica a compatibilidade antes de renderizar.
            if (!isPresetCompatible(video.info, preset)) {
                appendToLog(`     - ℹ️ PULANDO PRESET (incompatível): ${preset.name}`);
                continue;
            }
            
            presetsRendered++;
            const tempOutputPath = path.join(workDir, `${path.parse(sourceFileName).name}_${preset.name}_temp.mp4`);
            
            preset.sourceDuration = video.info.duration;

            appendToLog(`     - RENDERIZANDO PRESET: ${preset.name}`);
            await FfmpegService.renderVideo({
                inputPath: sourceForProcessing,
                outputPath: tempOutputPath,
                preset: preset,
                onProgress: (progress) => {
                    mainWindow.webContents.send('progress-update', { videoPath: video.path, progress });
                },
            });

            // 4. Renomeia o arquivo final
            const finalName = await RenameService.renameOutputFile(tempOutputPath, preset, clientName);
            appendToLog(`       - RENOMEADO PARA: ${finalName}`);
        }

        if (presetsRendered === 0) {
             appendToLog(`   - ⚠️ AVISO: Nenhum preset compatível foi encontrado para este arquivo.`);
        }

        mainWindow.webContents.send('processing-completed', video.path);
        appendToLog(`--- CONCLUÍDO: ${path.basename(video.path)} ---`);

    } catch (error) {
        appendToLog(`   - ❌ ERRO ao processar ${path.basename(video.path)}: ${error.message}`);
        mainWindow.webContents.send('processing-error', { videoPath: video.path, error: error.message });
    }
}

module.exports = {
    start,
    pause,
    resume,
    cancel,
};
