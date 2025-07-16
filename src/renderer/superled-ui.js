// src/renderer/superled-ui.js
import * as dom from './dom.js';
import * as state from './state.js';

/**
 * Renderiza os itens de vídeo para um único painel SUPERLED.
 * @param {string} panelName - 'left', 'center', ou 'right'.
 */
function renderPanel(panelName) {
    const panelContainer = document.querySelector(`.panel-container[data-panel="${panelName}"]`);
    if (!panelContainer) return;

    const queueList = panelContainer.querySelector('.panel-queue-list');
    queueList.innerHTML = '';
    const videos = state.superLedPanels[panelName];

    videos.forEach(video => {
        const videoItem = document.createElement('div');
        videoItem.className = `video-item ${video.status}`;
        videoItem.dataset.path = video.path;
        videoItem.draggable = !state.isSuperLedProcessing;

        const fileName = video.path.split(/[\\/]/).pop();
        let detailsText = `<span class="video-detail">${state.translations.readingInfo || 'Lendo...'}</span>`;
        if (video.info) {
            detailsText = `<span class="video-detail">${video.info.width}x${video.info.height}</span> <span class="video-detail">${video.info.duration.toFixed(1)}s</span>`;
        }
        if (video.status === 'error-loading') {
            detailsText = `<span class="video-detail error">${state.translations.errorReadingFile || 'Erro'}</span>`;
        }

        videoItem.innerHTML = `
            <div class="video-info">
                <div class="file-name">${fileName}</div>
                <div class="video-details-container">${detailsText}</div>
            </div>
            <div class="queue-controls">
                <button class="queue-btn" data-action="delete" title="${state.translations.deleteFromQueue || 'Excluir'}" ${state.isSuperLedProcessing ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
        queueList.appendChild(videoItem);
    });
    updateSuperLedButtonState();
}

/** Renderiza todos os três painéis. */
export function renderAllPanels() {
    renderPanel('left');
    renderPanel('center');
    renderPanel('right');
}

/** Atualiza o estado do botão "Criar SUPERLED". */
export function updateSuperLedButtonState() {
    const { left, center, right } = state.superLedPanels;
    const isReady = left.length > 0 && center.length > 0 && right.length > 0 &&
                    [...left, ...center, ...right].every(v => v.status === 'pending');
    
    dom.startSuperLedBtn.disabled = !isReady || state.isSuperLedProcessing;
}

/** Limpa todos os painéis e o estado do SUPERLED. */
export function clearAllPanels() {
    state.setSuperLedPanelVideos('left', []);
    state.setSuperLedPanelVideos('center', []);
    state.setSuperLedPanelVideos('right', []);
    state.setSuperLedLog('');
    state.setIsSuperLedProcessing(false);
    dom.superLedProgressContainer.style.display = 'none';
    dom.superLedLogContainer.style.display = 'none';
    dom.superLedLogOutput.textContent = '';
    renderAllPanels();
}

/** Mostra e atualiza a barra de progresso. */
export function updateProgress(progress, step) {
    dom.superLedProgressContainer.style.display = 'block';
    dom.superLedProgressBar.style.width = `${progress}%`;
    appendLog(step); // Adiciona a etapa atual ao log
}

/** Adiciona uma mensagem ao log da UI. */
export function appendLog(message) {
    dom.superLedLogContainer.style.display = 'block';
    state.appendToSuperLedLog(message);
    dom.superLedLogOutput.textContent = state.superLedLog;
    dom.superLedLogOutput.scrollTop = dom.superLedLogOutput.scrollHeight; // Auto-scroll
}

/** Lida com a conclusão bem-sucedida do processo. */
export function handleCompletion(finalPath, finalLog) {
    state.setIsSuperLedProcessing(false);
    updateSuperLedButtonState();
    dom.superLedProgressBar.style.width = '100%';
    dom.superLedProgressBar.classList.add('completed');
}

/** Lida com erros durante o processo. */
export function handleError(error, finalLog) {
    state.setIsSuperLedProcessing(false);
    updateSuperLedButtonState();
    dom.superLedProgressBar.style.width = '100%';
    dom.superLedProgressBar.classList.add('error');
}
