// src/main/services/SuperLedService.js
const path =require('path');
const fs = require('fs');
const { app } = require('electron');
const FfmpegService = require('./FfmpegService');
const FileService = require('./FileService');

const TEMP_DIR_NAME = '.w4lle-superled-temp';
const FINAL_DURATION = 30; // Duração final do vídeo SUPERLED em segundos

/**
 * Prepara um único painel (Esquerdo, Central ou Direito).
 * Concatena ou estende os vídeos para que o clipe resultante tenha exatamente 30 segundos.
 * @param {Array<object>} panelVideos - Lista de objetos de vídeo para o painel.
 * @param {object} resolution - A resolução de saída para este painel { width, height }.
 * @param {string} tempDirPath - O caminho para o diretório temporário.
 * @param {string} panelName - O nome do painel (ex: 'left', 'center').
 * @param {function} onProgress - Callback de progresso.
 * @returns {Promise<string>} O caminho para o vídeo do painel processado.
 */
async function preparePanelVideo(panelVideos, resolution, tempDirPath, panelName, onProgress) {
    if (panelVideos.length === 0) {
        throw new Error(`Nenhum vídeo fornecido para o painel ${panelName}.`);
    }

    const outputPanelPath = path.join(tempDirPath, `panel_${panelName}_final.mp4`);
    let intermediateClips = [];

    // Fase 1: Processa cada clipe individualmente para a resolução correta
    for (let i = 0; i < panelVideos.length; i++) {
        const video = panelVideos[i];
        const clipOutputPath = path.join(tempDirPath, `panel_${panelName}_clip_${i}.mp4`);
        await FfmpegService.runFfmpegCommand([
            '-i', video.path,
            '-vf', `scale=${resolution.width}:${resolution.height},setsar=1`,
            '-an', // Remove áudio
            '-y',
            clipOutputPath
        ]);
        intermediateClips.push(clipOutputPath);
    }
    
    // Fase 2: Concatena ou estende os clipes para a duração final
    let filterComplex;
    const inputs = intermediateClips.flatMap(clip => ['-i', clip]);

    if (intermediateClips.length === 1) {
        // Estende um único vídeo
        filterComplex = `[0:v]tpad=stop_mode=clone:stop_duration=${FINAL_DURATION - panelVideos[0].info.duration}[v]`;
    } else if (intermediateClips.length === 2) {
        // Estende cada um para 15s e concatena
        const duration1 = FINAL_DURATION / 2 - panelVideos[0].info.duration;
        const duration2 = FINAL_DURATION / 2 - panelVideos[1].info.duration;
        filterComplex = `[0:v]tpad=stop_mode=clone:stop_duration=${duration1}[v0];` +
                        `[1:v]tpad=stop_mode=clone:stop_duration=${duration2}[v1];` +
                        `[v0][v1]concat=n=2:v=1[v]`;
    } else { // 3 clipes
        filterComplex = `[0:v][1:v][2:v]concat=n=3:v=1[v]`;
    }

    await FfmpegService.runFfmpegCommand([
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-t', FINAL_DURATION,
        '-y',
        outputPanelPath
    ], (progress) => onProgress(progress, `Preparando painel ${panelName}...`));

    return outputPanelPath;
}


/**
 * Orquestra a criação do vídeo SUPERLED.
 * @param {object} data - Dados da UI { left: [], center: [], right: [] }.
 * @param {BrowserWindow} win - A instância da janela principal para enviar eventos.
 */
async function createSuperLed(data, win) {
    const { left, center, right, clientName } = data;
    const workDir = path.dirname(left[0].path); // Assume que o primeiro vídeo define o diretório de trabalho
    const tempDirPath = path.join(workDir, TEMP_DIR_NAME);
    let fullLog = '[SUPERLED] Iniciando processo...\n';

    const sendLog = (msg) => {
        fullLog += msg + '\n';
        win.webContents.send('superled:log', msg);
    };

    const sendProgress = (progress, step) => {
        win.webContents.send('superled:progress', { progress, step });
    };

    try {
        await FileService.ensureDirExists(tempDirPath);
        sendLog(`- Diretório temporário criado em: ${tempDirPath}`);

        const resolutions = {
            left: { width: 768, height: 1152 },
            center: { width: 2112, height: 1152 },
            right: { width: 768, height: 1152 }
        };

        // Prepara cada painel em paralelo
        const [leftPanelPath, centerPanelPath, rightPanelPath] = await Promise.all([
            preparePanelVideo(left, resolutions.left, tempDirPath, 'left', sendProgress),
            preparePanelVideo(center, resolutions.center, tempDirPath, 'center', sendProgress),
            preparePanelVideo(right, resolutions.right, tempDirPath, 'right', sendProgress)
        ]);
        
        sendLog('- Painéis individuais processados com sucesso.');
        
        // Une os 3 painéis
        const finalBaseName = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_SUPERLED_${clientName || 'W4LLE'}`;
        const finalOutputPath = path.join(workDir, FileService.getUniqueFileName(workDir, finalBaseName, '.mp4'));
        
        sendLog('- Unindo os painéis para criar o vídeo final...');
        await FfmpegService.runFfmpegCommand([
            '-i', leftPanelPath,
            '-i', centerPanelPath,
            '-i', rightPanelPath,
            '-filter_complex', '[0:v][1:v][2:v]hstack=inputs=3[v]',
            '-map', '[v]',
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'fast',
            '-y',
            finalOutputPath
        ], (progress) => sendProgress(progress, 'Finalizando...'));

        sendLog(`- ✅ SUCESSO! Vídeo final salvo em: ${finalOutputPath}`);
        win.webContents.send('superled:complete', { path: finalOutputPath, log: fullLog });

    } catch (error) {
        const errorMessage = `- ❌ ERRO: ${error.message}`;
        sendLog(errorMessage);
        console.error(error);
        win.webContents.send('superled:error', { error: errorMessage, log: fullLog });
    } finally {
        // Limpa o diretório temporário
        await FileService.removeItem(tempDirPath);
        sendLog('- Limpeza do diretório temporário concluída.');
    }
}

module.exports = {
    createSuperLed,
};
