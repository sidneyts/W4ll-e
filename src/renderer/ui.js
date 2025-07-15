// src/renderer/ui.js
import * as dom from './dom.js';
import * as state from './state.js';
import { createSafeIdForPath } from './utils.js';

// --- Funções de Atualização da UI ---

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
        dom.pauseBtn.textContent = state.translations.pause || 'Pause';
        if(state.isPaused) dom.pauseBtn.textContent = state.translations.resume || 'Resume';
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
        p.textContent = state.translations.emptyQueue || 'Empty queue';
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
            let tooltipText = '';
            let detailsText = '';

            if (video.status === 'completed') {
                statusIcon = `<div class="queue-btn" title="${state.translations.statusCompleted || 'Completed'}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`;
            } else if (video.status === 'error') {
                statusIcon = `<button class="queue-btn" data-action="show-log" title="${state.translations.statusError || 'Error. Click to see log.'}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-red-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></button>`;
            } else if (video.status === 'error-loading') {
                statusIcon = `<div class="queue-btn" title="${state.translations.errorLoadingTooltip || 'Failed to read file'}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>`;
            } else {
                statusIcon = `<button class="queue-btn" data-action="delete" title="${state.translations.deleteFromQueue || 'Delete from queue'}" ${state.isProcessing ? 'disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>`;
            }

            if (video.info) {
                const resText = `${video.info.width}x${video.info.height}`;
                const durText = `${video.info.duration.toFixed(1)}s`;
                detailsText = `<span class="video-detail">${resText}</span> <span class="video-detail">${durText}</span>`;
                tooltipText = `${state.translations.resolution || 'Resolution'}: ${video.info.width}x${video.info.height} | ${state.translations.duration || 'Duration'}: ${video.info.duration.toFixed(2)}s`;
            } else if (video.status === 'error-loading') {
                detailsText = `<span class="video-detail text-yellow-400/80">${state.translations.errorReadingFile || 'Error reading file'}</span>`;
                tooltipText = state.translations.errorLoadingTooltip || 'Failed to read file. It may be corrupt.';
            } else {
                detailsText = `<span class="video-detail">${state.translations.readingInfo || 'Reading info...'}</span>`;
                tooltipText = state.translations.readingInfo || 'Reading info...';
            }

            videoItem.innerHTML = `
                <div class="video-info" title="${tooltipText}">
                    <div class="file-name">${fileName}</div>
                    <div class="video-details-container">${detailsText}</div>
                    <progress id="progress-${createSafeIdForPath(video.path)}" value="${video.progress || 0}" max="100"></progress>
                </div>
                <div class="queue-controls">${statusIcon}</div>
            `;
            dom.queueList.appendChild(videoItem);

            if (video.status === 'error' || video.status === 'error-loading') {
                videoItem.querySelector('progress').classList.add('error');
            }
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
            checkbox.disabled = false;
            checkbox.checked = false;
            label.classList.remove('disabled', 'checked');
            label.title = '';
        });
        updateButtonsState();
        return;
    }

    for (const preset of state.presets) {
        const checkbox = document.getElementById(`preset-check-${preset.id}`);
        if (!checkbox) continue;

        let isCompatible = false;
        for (const video of state.videoQueue) {
            if (video.info) {
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
            label.title = state.translations.presetIncompatible || 'Incompatible with any video in the queue.';
        } else {
            label.classList.remove('disabled');
            label.title = '';
            if (!state.isProcessing) {
                checkbox.checked = true;
                label.classList.add('checked');
            }
        }
    }
    updateButtonsState();
}

export function renderPresetCheckboxes() {
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
}

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
    dom.presetDurationInput.value = preset.duration;
    dom.applyBarCheckbox.checked = preset.applyBar || false;
    dom.letterboxCheckbox.checked = preset.letterbox || false;
    dom.barSizeContainer.style.display = preset.applyBar ? 'block' : 'none';
    dom.presetForm.querySelector('#preset-barSize').value = preset.barSize || 0;
    dom.ratioToleranceInput.value = (preset.ratioTolerance || 0.2) * 100;
    dom.useOriginalDurationCheckbox.checked = preset.useOriginalDuration || false;
    dom.presetDurationInput.disabled = dom.useOriginalDurationCheckbox.checked;
    
    dom.deletePresetBtn.style.display = 'inline-flex';
    renderSavedPresetsList();
}

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
            const presetToEdit = state.presets.find(p => p.id === preset.id);
            if (presetToEdit) populateFormWithPreset(presetToEdit);
        });

        dom.savedPresetsList.appendChild(item);
    });
}

export function resetPresetForm() {
    state.setActivePresetId(null);
    dom.presetFormContainer.classList.add('opacity-0');
    dom.deletePresetBtn.style.display = 'none';
    setTimeout(() => {
        if (!state.activePresetId) {
            dom.presetForm.reset();
        }
    }, 200); // Atraso para resetar o formulário após o fade-out
    renderSavedPresetsList();
}

// --- Funções para Modais Customizados ---

export function showAlert(titleKey, messageKey) {
    dom.genericModalTitle.textContent = state.translations[titleKey] || titleKey;
    dom.genericModalMessage.textContent = state.translations[messageKey] || messageKey;

    dom.genericModalConfirmBtn.textContent = 'OK';
    dom.genericModalCancelBtn.style.display = 'none';
    dom.genericModal.style.display = 'flex';

    const okListener = () => {
        dom.genericModal.style.display = 'none';
        dom.genericModalConfirmBtn.removeEventListener('click', okListener);
    };
    dom.genericModalConfirmBtn.addEventListener('click', okListener);
}

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
