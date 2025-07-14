// src/renderer/ipc.js

// Este módulo configura todos os listeners para eventos vindos do processo principal (main).

import * as dom from './dom.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { createSafeIdForPath } from './utils.js'; // Importa a função utilitária

async function addFilesToQueue(filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    const uniquePaths = filePaths.filter(path => !state.videoQueue.some(v => v.path === path));
    
    // 1. Adiciona os arquivos à fila com um estado de "carregando" (info: null)
    for (const path of uniquePaths) {
        state.videoQueue.push({ path: path, status: 'pending', error: null, info: null, progress: 0 });
    }
    // 2. Atualiza a UI imediatamente para mostrar os arquivos sendo carregados
    ui.updateQueueUI();

    // 3. Busca as informações de todos os novos arquivos de forma concorrente
    const infoPromises = uniquePaths.map(path => window.electronAPI.getVideoInfo(path));
    const infos = await Promise.all(infoPromises);

    // 4. Atualiza o estado da fila com as informações obtidas
    uniquePaths.forEach((path, index) => {
        const video = state.videoQueue.find(v => v.path === path);
        if (video && infos[index]) {
            video.info = infos[index];
        }
    });

    // 5. Renderiza a UI novamente com as informações completas nos tooltips
    ui.updateQueueUI();
    ui.updatePresetAvailability();
}

export function initIpcHandlers() {
    window.electronAPI.handleFilesSelected((filePaths) => addFilesToQueue(filePaths));

    window.electronAPI.handleProgressUpdate(({ videoPath, progress }) => {
        const video = state.videoQueue.find(v => v.path === videoPath);
        if (video) {
            video.progress = progress;
            const progressBar = dom.queueList.querySelector(`#progress-${createSafeIdForPath(videoPath)}`);
            if (progressBar) { 
                progressBar.value = progress; 
            }
        }
    });

    window.electronAPI.handleProcessingStarted((videoPath) => {
        const video = state.videoQueue.find(v => v.path === videoPath);
        if (video) {
            video.status = 'processing';
            ui.updateQueueUI();
        }
    });

    window.electronAPI.handleProcessingCompleted((videoPath) => {
        const video = state.videoQueue.find(v => v.path === videoPath);
        if (video) {
            video.status = 'completed';
            video.progress = 100;
            ui.updateQueueUI();
        }
    });

    window.electronAPI.handleProcessingCancelled(() => {
        state.setIsProcessing(false);
        state.setIsPaused(false);
        state.videoQueue.forEach(v => {
            if (v.status === 'processing' || v.status === 'pending') {
                v.status = 'cancelled';
            }
        });
        ui.updateQueueUI();
        ui.updateButtonsState();
    });

    window.electronAPI.handleProcessingError(({ videoPath, error }) => {
        const video = state.videoQueue.find(v => v.path === videoPath);
        if (video) {
            video.status = 'error';
            video.error = error;
            video.progress = 100;
            ui.updateQueueUI();
        }
    });

    window.electronAPI.handleFinalLog((log) => {
        state.setFinalLogContent(log);
        state.setIsProcessing(false);
        state.setIsPaused(false);
        ui.updateButtonsState();
    });

    window.electronAPI.handleWindowFocusChange((isFocused) => {
        dom.appWrapper.classList.toggle('app-blurred', !isFocused);
    });
}
