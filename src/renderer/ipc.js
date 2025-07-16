// src/renderer/ipc.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as ui from './ui.js';
import * as superLedUi from './superled-ui.js';
import { createSafeIdForPath } from './utils.js';

// --- Funções de Carregamento de Arquivos ---

async function addFilesToQueue(filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    const uniquePaths = filePaths.filter(path => !state.videoQueue.some(v => v.path === path));
    
    for (const path of uniquePaths) {
        state.videoQueue.push({ path: path, status: 'loading', error: null, info: null, progress: 0 });
    }
    ui.updateQueueUI();

    const infoPromises = uniquePaths.map(async (path) => {
        const info = await window.electronAPI.getVideoInfo(path);
        const video = state.videoQueue.find(v => v.path === path);
        if (video) {
            video.info = info ? info : { width: 0, height: 0, duration: 0 };
            video.status = info ? 'pending' : 'error-loading';
        }
    });

    await Promise.all(infoPromises);
    ui.updateQueueUI();
}

async function addFilesToSuperLedPanel(panel, filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    
    const newVideos = [];
    for (const path of filePaths) {
        newVideos.push({ path: path, status: 'loading', error: null, info: null });
    }
    state.addVideosToSuperLedPanel(panel, newVideos);
    superLedUi.renderAllPanels();

    const infoPromises = newVideos.map(async (video) => {
        const info = await window.electronAPI.getVideoInfo(video.path);
        const videoInPanel = state.superLedPanels[panel].find(v => v.path === video.path);
        if (videoInPanel) {
            videoInPanel.info = info ? info : { width: 0, height: 0, duration: 0 };
            videoInPanel.status = info ? 'pending' : 'error-loading';
        }
    });

    await Promise.all(infoPromises);
    superLedUi.renderAllPanels();
}


// --- Inicialização dos Handlers ---

export function initIpcHandlers() {
    // Handlers do Conversor Padrão
    window.electronAPI.handleFilesSelected((filePaths) => addFilesToQueue(filePaths));
    
    window.electronAPI.handleProgressUpdate(({ videoPath, progress }) => {
        const video = state.videoQueue.find(v => v.path === videoPath);
        if (video) {
            video.progress = progress; // Salva o progresso no estado
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
        ui.updateQueueUI(); // Atualiza a fila e re-habilita presets
    });

    // Handlers do Criador SUPERLED
    window.electronAPI.handleFilesSelectedSuperLed(({ files, panel }) => addFilesToSuperLedPanel(panel, files));
    window.electronAPI.handleSuperLedProgress(({ progress, step }) => superLedUi.updateProgress(progress, step));
    window.electronAPI.handleSuperLedLog((message) => superLedUi.appendLog(message));
    window.electronAPI.handleSuperLedComplete(({ path, log }) => superLedUi.handleCompletion(path, log));
    window.electronAPI.handleSuperLedError(({ error, log }) => superLedUi.handleError(error, log));

    // Handlers Gerais da UI
    window.electronAPI.handleWindowFocusChange((isFocused) => {
        dom.appWrapper.classList.toggle('app-blurred', !isFocused);
    });
    window.electronAPI.handleShowAlert(({ titleKey, messageKey }) => ui.showAlert(titleKey, messageKey));
    window.electronAPI.handleShowConfirm((options, actionId) => ui.showConfirm({ ...options, actionId }));
}
