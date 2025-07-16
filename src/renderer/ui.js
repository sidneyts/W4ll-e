// src/renderer/ui.js
import * as dom from './dom.js';
import * as state from './state.js';
import { createSafeIdForPath } from './utils.js';

// --- Funções de Atualização da UI do Conversor ---

export function updateButtonsState() {
    const hasItems = state.videoQueue.length > 0;
    const hasPendingItems = state.videoQueue.some(v => ['pending', 'error', 'cancelled', 'error-loading'].includes(v.status));
    const hasSelectedPresets = dom.presetsCheckboxList.querySelectorAll('input:checked').length > 0;

    if (state.isProcessing) {
        dom.startBtn.style.display = 'none';
        dom.clearQueueBtn.style.display = 'none';
        dom.logBtn.style.display = 'none';
        dom.pauseBtn.style.display = 'inline-flex';
        dom.cancelBtn.style.display = 'inline-flex';
        dom.pauseBtn.textContent = state.isPaused ? (state.translations.resume || 'Resume') : (state.translations.pause || 'Pause');
        dom.managePresetsBtn.disabled = true;
    } else {
        dom.startBtn.style.display = hasPendingItems && hasSelectedPresets ? 'inline-flex' : 'none';
        dom.pauseBtn.style.display = 'none';
        dom.cancelBtn.style.display = 'none';
        dom.clearQueueBtn.style.display = hasItems ? 'inline-flex' : 'none';
        dom.logBtn.style.display = state.finalLogContent ? 'inline-flex' : 'none';
        dom.managePresetsBtn.disabled = false;
    }
}

export function updateQueueUI() {
    dom.queueList.innerHTML = '';
    
    if (state.videoQueue.length === 0) {
        const p = document.createElement('p');
        p.textContent = state.translations.emptyQueue || 'Fila vazia';
        p.className = 'text-center text-slate-400 p-4';
        dom.queueList.appendChild(p);
    } else {
        state.videoQueue.forEach((video) => {
            const videoItem = document.createElement('div');
            videoItem.className = `video-item ${video.status}`;
            videoItem.dataset.path = video.path;
            videoItem.draggable = !state.isProcessing;

            const fileName = video.path.split(/[\\/]/).pop();
            
            let statusIcon = '';
            let detailsText = '';

            if (video.status === 'completed') {
                statusIcon = `<div class="queue-btn" title="${state.translations.statusCompleted}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`;
            } else if (video.status === 'error') {
                statusIcon = `<button class="queue-btn" data-action="show-log" title="${state.translations.statusError}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-red-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></button>`;
            } else if (video.status === 'error-loading') {
                statusIcon = `<div class="queue-btn" title="${state.translations.errorLoadingTooltip}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>`;
            } else {
                statusIcon = `<button class="queue-btn" data-action="delete" title="${state.translations.deleteFromQueue}" ${state.isProcessing ? 'disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>`;
            }

            if (video.info) {
                detailsText = `<span class="video-detail">${video.info.width}x${video.info.height}</span> <span class="video-detail">${video.info.duration.toFixed(1)}s</span>`;
            } else {
                detailsText = `<span class="video-detail">${state.translations.readingInfo}</span>`;
            }

            videoItem.innerHTML = `
                <div class="video-info">
                    <div class="file-name">${fileName}</div>
                    <div class="video-details-container">${detailsText}</div>
                    <progress id="progress-${createSafeIdForPath(video.path)}" value="${video.progress || 0}" max="100"></progress>
                </div>
                <div class="queue-controls">${statusIcon}</div>
            `;
            dom.queueList.appendChild(videoItem);
        });
    }
    updateButtonsState();
    updatePresetAvailability();
}

export async function updatePresetAvailability() {
    const checkboxes = dom.presetsCheckboxList.querySelectorAll('input[type="checkbox"]');
    if (state.videoQueue.length === 0) {
        checkboxes.forEach(checkbox => {
            const label = checkbox.parentElement;
            checkbox.disabled = true;
            label.classList.add('disabled');
            label.title = state.translations.emptyQueue || 'Fila vazia';
        });
        updateButtonsState();
        return;
    }

    for (const preset of state.presets) {
        const checkbox = document.getElementById(`preset-check-${preset.id}`);
        if (!checkbox) continue;

        let isCompatible = false;
        for (const video of state.videoQueue) {
            if (video.info && video.status !== 'error-loading') {
                if (await window.electronAPI.isPresetCompatible(video.info, preset)) {
                    isCompatible = true;
                    break; 
                }
            }
        }
        
        const label = checkbox.parentElement;
        checkbox.disabled = !isCompatible;
        
        if (!isCompatible) {
            checkbox.checked = false;
            label.classList.add('disabled');
            label.classList.remove('checked');
            label.title = state.translations.presetIncompatible || 'Incompatível';
        } else {
            label.classList.remove('disabled');
            label.title = '';
            // CORREÇÃO: Seleciona automaticamente se não estiver processando
            if (!state.isProcessing) {
                checkbox.checked = true;
            }
            label.classList.toggle('checked', checkbox.checked);
        }
    }
    updateButtonsState();
}

/**
 * Renderiza os checkboxes de presets na sidebar.
 */
export function renderPresetCheckboxes() {
    const checkedIds = new Set(Array.from(dom.presetsCheckboxList.querySelectorAll('input:checked')).map(cb => cb.value));
    dom.presetsCheckboxList.innerHTML = '';
    state.presets.forEach(preset => {
        const label = document.createElement('label');
        label.className = 'preset-checkbox-label';
        label.htmlFor = `preset-check-${preset.id}`;
        label.dataset.id = preset.id;
        label.draggable = true;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `preset-check-${preset.id}`;
        checkbox.value = preset.id;
        if (checkedIds.has(preset.id)) {
            checkbox.checked = true;
            label.classList.add('checked');
        }
        
        const span = document.createElement('span');
        span.textContent = preset.name;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        
        checkbox.addEventListener('change', () => {
            label.classList.toggle('checked', checkbox.checked);
            updateButtonsState();
        });
        
        dom.presetsCheckboxList.appendChild(label);
    });
    updatePresetAvailability();
}


// --- Funções de UI de Presets (Modal) ---

/**
 * Preenche o formulário do modal de presets com os dados de um preset selecionado.
 * @param {object} preset - O objeto do preset a ser editado.
 */
export function populateFormWithPreset(preset) {
    if (!preset) {
        resetPresetForm();
        return;
    }
    state.setActivePresetId(preset.id);
    dom.presetFormContainer.classList.remove('opacity-0');
    
    dom.presetForm.querySelector('#preset-id').value = preset.id;
    dom.presetForm.querySelector('#preset-name').value = preset.name;
    dom.presetForm.querySelector('#preset-width').value = preset.width;
    dom.presetForm.querySelector('#preset-height').value = preset.height;
    dom.presetForm.querySelector('#preset-duration').value = preset.duration;
    dom.presetForm.querySelector('#preset-applyBar').checked = preset.applyBar || false;
    dom.presetForm.querySelector('#preset-letterbox').checked = preset.letterbox || false;
    dom.presetForm.querySelector('#preset-barSize').value = preset.barSize || 0;
    dom.presetForm.querySelector('#preset-ratioTolerance').value = (preset.ratioTolerance || 0.2) * 100;
    dom.presetForm.querySelector('#preset-useOriginalDuration').checked = preset.useOriginalDuration || false;
    
    dom.presetForm.querySelector('#preset-duration').disabled = preset.useOriginalDuration;
    dom.barSizeContainer.style.display = preset.applyBar ? 'block' : 'none';
    
    dom.deletePresetBtn.style.display = 'inline-flex';
    renderSavedPresetsList();
}

/**
 * Renderiza a lista de presets salvos no modal de gerenciamento.
 */
export function renderSavedPresetsList() {
    dom.savedPresetsList.innerHTML = '';
    state.presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'saved-preset-item';
        item.dataset.id = preset.id;
        item.draggable = true;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = preset.name;
        nameSpan.style.pointerEvents = 'none';
        
        item.appendChild(nameSpan);
        
        if (preset.id === state.activePresetId) {
            item.classList.add('active');
        }

        item.addEventListener('click', () => {
            populateFormWithPreset(preset);
        });

        dom.savedPresetsList.appendChild(item);
    });
}

/**
 * Limpa e esconde o formulário do modal de presets.
 */
export function resetPresetForm() {
    state.setActivePresetId(null);
    dom.presetFormContainer.classList.add('opacity-0');
    dom.deletePresetBtn.style.display = 'none';
    setTimeout(() => {
        if (!state.activePresetId) {
            dom.presetForm.reset();
        }
    }, 200);
    renderSavedPresetsList();
}


// --- Funções de Modais ---

/**
 * Exibe o modal com o log de processamento.
 */
export function showLogModal() {
    dom.logOutput.textContent = state.finalLogContent;
    dom.logModal.style.display = 'flex';
}

/**
 * Exibe o modal de gerenciamento de presets.
 */
export function showPresetsModal() {
    renderSavedPresetsList();
    resetPresetForm();
    dom.presetsModal.style.display = 'flex';
}

/**
 * Exibe o modal de configurações.
 */
export async function showSettingsModal() {
    const lang = await window.electronAPI.getSetting('language') || 'pt';
    const preset = await window.electronAPI.getSetting('encoderPreset') || 'fast';
    const crf = await window.electronAPI.getSetting('qualityFactor') || 25;
    
    dom.languageSelect.value = lang;
    dom.encoderPresetSelect.value = preset;
    dom.qualityFactorSlider.value = crf;
    dom.qualityFactorValue.textContent = crf;
    
    dom.settingsModal.style.display = 'flex';
}

/**
 * Exibe um modal de alerta genérico.
 * @param {string} titleKey - Chave de tradução para o título.
 * @param {string} messageKey - Chave de tradução para a mensagem.
 */
export function showAlert(titleKey, messageKey) {
    dom.genericModalTitle.textContent = state.translations[titleKey] || titleKey;
    dom.genericModalMessage.textContent = state.translations[messageKey] || messageKey;

    dom.genericModalConfirmBtn.textContent = 'OK';
    dom.genericModalCancelBtn.style.display = 'none';
    dom.genericModal.style.display = 'flex';

    return new Promise((resolve) => {
        const okListener = () => {
            dom.genericModal.style.display = 'none';
            dom.genericModalConfirmBtn.removeEventListener('click', okListener);
            resolve(true);
        };
        dom.genericModalConfirmBtn.addEventListener('click', okListener);
    });
}

/**
 * Exibe um modal de confirmação genérico.
 * @param {object} options - Opções para o modal.
 * @returns {Promise<boolean>} - Resolve como true se confirmado, false se cancelado.
 */
export function showConfirm(options) {
    const { titleKey, messageKey, confirmKey, cancelKey, actionId } = options;

    dom.genericModalTitle.textContent = state.translations[titleKey] || titleKey;
    dom.genericModalMessage.textContent = state.translations[messageKey] || messageKey;
    dom.genericModalConfirmBtn.textContent = state.translations[confirmKey] || 'Confirm';
    dom.genericModalCancelBtn.textContent = state.translations[cancelKey] || 'Cancel';
    
    dom.genericModalCancelBtn.style.display = 'inline-flex';
    dom.genericModal.style.display = 'flex';

    return new Promise((resolve) => {
        const confirmListener = () => {
            cleanup();
            if (actionId) window.electronAPI.sendConfirmResult(actionId);
            resolve(true);
        };
        const cancelListener = () => {
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            dom.genericModal.style.display = 'none';
            dom.genericModalConfirmBtn.removeEventListener('click', confirmListener);
            dom.genericModalCancelBtn.removeEventListener('click', cancelListener);
        };

        dom.genericModalConfirmBtn.addEventListener('click', confirmListener);
        dom.genericModalCancelBtn.addEventListener('click', cancelListener);
    });
}

// --- Funções de Ação ---

/**
 * Inicia o processamento da fila do conversor.
 */
export function startQueue() {
    const selectedPresetIds = Array.from(dom.presetsCheckboxList.querySelectorAll('input:checked')).map(input => input.value);
    const selectedPresets = state.presets.filter(p => selectedPresetIds.includes(p.id));
    const pendingVideos = state.videoQueue.filter(v => ['pending', 'error', 'cancelled', 'error-loading'].includes(v.status));

    if (pendingVideos.length > 0 && selectedPresets.length > 0) {
        state.setIsProcessing(true);
        state.setIsPaused(false);
        state.setFinalLogContent('');
        updateQueueUI();
        window.electronAPI.startQueue({ videos: pendingVideos, clientName: dom.clientNameInput.value, selectedPresets });
    }
}

/**
 * Pausa ou retoma o processamento da fila.
 */
export function togglePause() {
    state.setIsPaused(!state.isPaused);
    state.isPaused ? window.electronAPI.pauseQueue() : window.electronAPI.resumeQueue();
    updateButtonsState();
}

/**
 * Lida com cliques nos botões de um item da fila (excluir, ver log).
 * @param {Event} event - O evento de clique.
 */
export function handleQueueItemClick(event) {
    const button = event.target.closest('.queue-btn');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const videoItem = button.closest('.video-item');
    const filePath = videoItem.dataset.path;

    if (action === 'delete') {
        state.setVideoQueue(state.videoQueue.filter(v => v.path !== filePath));
        updateQueueUI();
    } else if (action === 'show-log') {
        showLogModal();
    }
}
