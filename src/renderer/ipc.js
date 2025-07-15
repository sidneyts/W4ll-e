// src/renderer/ipc.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { createSafeIdForPath } from './utils.js';

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
            if (info) {
                video.info = info;
                video.status = 'pending';
            } else {
                // CORREÇÃO: Define um estado de erro específico para falha na leitura
                video.status = 'error-loading';
            }
        }
    });

    await Promise.all(infoPromises);

    // Renderiza a UI novamente com as informações completas ou o estado de erro
    ui.updateQueueUI();
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
    });

    window.electronAPI.handleProcessingError(({ videoPath, error }) => {
        const video = state.videoQueue.find(v => v.path === videoPath);
        if (video) {
            video.status = 'error';
            video.error = error;
            video.progress = 100; // Marca como "concluído" para mostrar o erro
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

    // Handlers para os novos modais customizados
    window.electronAPI.handleShowAlert(({ titleKey, messageKey }) => {
        ui.showAlert(titleKey, messageKey);
    });

    window.electronAPI.handleShowConfirm((options, actionId) => {
        ui.showConfirm({ ...options, actionId });
    });
}
