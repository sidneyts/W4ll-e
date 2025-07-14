// src/renderer/ui.js

// Este módulo contém todas as funções que manipulam diretamente a interface (UI).

import * as dom from './dom.js';
import * as state from './state.js';
import { createSafeIdForPath } from './utils.js'; // Importa a função utilitária

// --- Funções de Atualização da UI ---

export function updateButtonsState() {
    const hasItems = state.videoQueue.length > 0;
    const hasPendingItems = state.videoQueue.some(v => v.status === 'pending' || v.status === 'error' || v.status === 'cancelled');
    const hasSelectedPresets = dom.presetsCheckboxList.querySelectorAll('input:checked').length > 0;

    if (state.isProcessing) {
        dom.startBtn.style.display = 'none';
        dom.clearQueueBtn.style.display = 'none';
        dom.logBtn.style.display = 'none';
        dom.pauseBtn.style.display = 'inline-flex';
        dom.cancelBtn.style.display = 'inline-flex';
        dom.pauseBtn.textContent = state.isPaused ? state.translations.resume : state.translations.pause;
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
            if (video.status === 'completed') {
                statusIcon = `<div class="queue-btn" title="Concluído"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`;
            } else if (video.status === 'error') {
                statusIcon = `<button class="queue-btn" data-action="show-log" title="Erro na renderização. Clique para ver o log."><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-red-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></button>`;
            } else {
                statusIcon = `<button class="queue-btn" data-action="delete" title="Excluir da fila" ${state.isProcessing ? 'disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>`;
            }

            videoItem.innerHTML = `
                <div class="drag-handle" title="Arrastar para reordenar"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg></div>
                <div class="video-info">
                    <div class="file-name">${fileName}</div>
                    <progress id="progress-${createSafeIdForPath(video.path)}" value="${video.progress || 0}" max="100"></progress>
                </div>
                <div class="queue-controls">${statusIcon}</div>
            `;
            dom.queueList.appendChild(videoItem);

            if (video.status === 'error') {
                videoItem.querySelector('progress').classList.add('error');
            }
        });
    }
    updateButtonsState();
    if (state.videoQueue.length > 0) updatePresetAvailability();
}

export function updatePresetAvailability() {
    if (state.videoQueue.length === 0) {
        dom.presetsCheckboxList.querySelectorAll('label').forEach(label => {
            const checkbox = document.getElementById(label.htmlFor);
            if (checkbox) {
                checkbox.disabled = false;
                checkbox.checked = false;
            }
            label.classList.remove('disabled', 'checked');
            label.title = '';
        });
        updateButtonsState();
        return;
    }

    state.presets.forEach(preset => {
        const checkbox = document.getElementById(`preset-check-${preset.id}`);
        if (!checkbox) return;

        const isCompatible = state.videoQueue.some(video => {
            if (!video.info) return false;
            const sourceRatio = video.info.width / video.info.height;
            const presetRatio = preset.width / preset.height;
            const ratioDiff = Math.abs(sourceRatio - presetRatio);
            const timeDiff = Math.abs(video.info.duration - preset.duration);
            return ratioDiff <= 0.2 && timeDiff <= 2;
        });

        const label = checkbox.parentElement;
        checkbox.disabled = !isCompatible;
        
        if (!isCompatible) {
            checkbox.checked = false;
            label.classList.add('disabled');
            label.classList.remove('checked');
            label.title = 'Incompatível com qualquer vídeo na fila.';
        } else {
            label.classList.remove('disabled');
            label.title = '';
            checkbox.checked = true;
            label.classList.add('checked');
        }
    });
    updateButtonsState();
}

export function renderPresetCheckboxes() {
    dom.presetsCheckboxList.innerHTML = '';
    dom.presetsCheckboxList.className = 'flex-grow space-y-2 pr-2 overflow-y-auto custom-scrollbar';

    state.presets.forEach(preset => {
        const label = document.createElement('label');
        label.className = 'preset-checkbox-label';
        label.htmlFor = `preset-check-${preset.id}`;
        
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

export function renderSavedPresetsList() {
    dom.savedPresetsList.innerHTML = '';
    const newPresetItem = document.createElement('div');
    newPresetItem.textContent = state.translations.addNewPreset || '+ Adicionar Predefinição';
    newPresetItem.className = 'saved-preset-item font-bold text-purple-300';
    newPresetItem.addEventListener('click', () => {
        state.setActivePresetId(null);
        dom.presetForm.reset();
        dom.barSizeContainer.style.display = 'none';
        dom.presetFormTitle.textContent = state.translations.addNewPreset || 'Adicionar Predefinição';
        dom.deletePresetBtn.style.display = 'none';
        document.querySelectorAll('.saved-preset-item.active').forEach(el => el.classList.remove('active'));
        newPresetItem.classList.add('active');
    });
    dom.savedPresetsList.appendChild(newPresetItem);

    state.presets.forEach(preset => {
        const item = document.createElement('div');
        item.textContent = preset.name;
        item.className = 'saved-preset-item';
        item.dataset.id = preset.id;
        if (preset.id === state.activePresetId) {
            item.classList.add('active');
        }
        item.addEventListener('click', () => {
            state.setActivePresetId(preset.id);
            dom.presetFormTitle.textContent = state.translations.editPreset || 'Editar Predefinição';
            document.getElementById('preset-id').value = preset.id;
            document.getElementById('preset-name').value = preset.name;
            document.getElementById('preset-width').value = preset.width;
            document.getElementById('preset-height').value = preset.height;
            document.getElementById('preset-duration').value = preset.duration;
            dom.applyBarCheckbox.checked = preset.applyBar;
            document.getElementById('preset-letterbox').checked = preset.letterbox;
            document.getElementById('preset-barSize').value = preset.barSize || 0;
            dom.barSizeContainer.style.display = preset.applyBar ? 'block' : 'none';
            dom.deletePresetBtn.style.display = 'inline-flex';
            renderSavedPresetsList();
        });
        dom.savedPresetsList.appendChild(item);
    });

    if (!state.activePresetId) {
        newPresetItem.classList.add('active');
    }
}

export function resetPresetForm() {
    state.setActivePresetId(null);
    dom.presetForm.reset();
    dom.barSizeContainer.style.display = 'none';
    dom.presetFormTitle.textContent = state.translations.addNewPreset || 'Adicionar Predefinição';
    dom.deletePresetBtn.style.display = 'none';
    renderSavedPresetsList();
}
