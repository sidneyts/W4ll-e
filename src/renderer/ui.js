// src/renderer/ui.js

import * as dom from './dom.js';
import * as state from './state.js';
import { createSafeIdForPath } from './utils.js';

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
    // Quando a fila está vazia, reseta todos os checkboxes para o estado padrão.
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

    // Quando há itens na fila, verifica a compatibilidade de cada preset.
    state.presets.forEach(preset => {
        const checkbox = document.getElementById(`preset-check-${preset.id}`);
        if (!checkbox) return;

        // Um preset é compatível se pelo menos um vídeo na fila for compatível com ele.
        const isCompatible = state.videoQueue.some(video => {
            if (!video.info) return false;
            const sourceRatio = video.info.width / video.info.height;
            const presetRatio = preset.width / preset.height;
            const ratioDiff = Math.abs(sourceRatio - presetRatio);
            const timeDiff = Math.abs(video.info.duration - preset.duration);
            return ratioDiff <= 0.2 && timeDiff <= 2;
        });

        const label = checkbox.parentElement;
        
        // Se não for compatível, desabilita e desmarca o checkbox.
        if (!isCompatible) {
            checkbox.disabled = true;
            checkbox.checked = false;
            label.classList.add('disabled');
            label.classList.remove('checked');
            label.title = 'Incompatível com qualquer vídeo na fila.';
        } else {
            // Se for compatível, apenas o habilita. NÃO altera o estado de 'checked'.
            // Isso preserva a escolha do usuário de marcar ou desmarcar.
            checkbox.disabled = false;
            label.classList.remove('disabled');
            label.title = '';
            // Atualiza o estilo visual baseado no estado atual do checkbox (escolha do usuário).
            label.classList.toggle('checked', checkbox.checked);
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

/**
 * Preenche o formulário com os dados de uma predefinição existente.
 * @param {object} preset - O objeto da predefinição para popular o formulário.
 */
export function populateFormWithPreset(preset) {
    state.setActivePresetId(preset.id);
    dom.presetFormTitle.textContent = state.translations.editPreset || 'Editar Predefinição';
    dom.presetForm.querySelector('#preset-id').value = preset.id;
    dom.presetForm.querySelector('#preset-name').value = preset.name;
    dom.presetForm.querySelector('#preset-width').value = preset.width;
    dom.presetForm.querySelector('#preset-height').value = preset.height;
    dom.presetForm.querySelector('#preset-duration').value = preset.duration;
    dom.applyBarCheckbox.checked = preset.applyBar || false;
    dom.presetForm.querySelector('#preset-letterbox').checked = preset.letterbox || false;
    dom.barSizeContainer.style.display = preset.applyBar ? 'block' : 'none';
    dom.presetForm.querySelector('#preset-barSize').value = preset.barSize || 0;
    
    dom.deletePresetBtn.style.display = 'inline-flex';
    renderSavedPresetsList(); // Re-renderiza a lista para atualizar o item ativo
}

/**
 * Renderiza a lista de predefinições salvas no modal.
 */
export function renderSavedPresetsList() {
    dom.savedPresetsList.innerHTML = '';
    
    state.presets.forEach(preset => {
        const item = document.createElement('div');
        item.textContent = preset.name;
        item.className = 'saved-preset-item';
        item.dataset.id = preset.id;
        
        if (preset.id === state.activePresetId) {
            item.classList.add('active');
        }
        
        dom.savedPresetsList.appendChild(item);
    });
}

/**
 * Limpa o formulário de predefinições para o estado de "Adicionar Novo".
 */
export function resetPresetForm() {
    state.setActivePresetId(null);
    dom.presetForm.reset();
    document.getElementById('preset-id').value = ''; // Garante que o ID oculto seja limpo
    dom.barSizeContainer.style.display = 'none';
    dom.presetFormTitle.textContent = state.translations.addNewPreset || 'Adicionar Predefinição';
    dom.deletePresetBtn.style.display = 'none';
    renderSavedPresetsList(); // Re-renderiza a lista para remover a seleção ativa
}
