// src/renderer/events.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as ui from './ui.js';
import * as superLedUi from './superled-ui.js';

// --- Funções de Utilitários de Eventos ---

/**
 * Função genérica para inicializar a lógica de arrastar e soltar em uma lista.
 * @param {HTMLElement} listElement - O elemento da lista.
 * @param {string} itemSelector - O seletor para os itens arrastáveis.
 * @param {function} onDropCallback - Função chamada após o drop.
 */
function initDragAndDrop(listElement, itemSelector, onDropCallback) {
    let draggedElement = null;

    const getDragAfterElement = (container, y) => {
        const draggableElements = [...container.querySelectorAll(`${itemSelector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    listElement.addEventListener('dragstart', (e) => {
        draggedElement = e.target.closest(itemSelector);
        if (draggedElement) {
            setTimeout(() => draggedElement.classList.add('dragging'), 0);
        }
    });

    listElement.addEventListener('dragend', (e) => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            draggedElement = null;
        }
    });

    listElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
            listElement.appendChild(draggedElement);
        } else {
            listElement.insertBefore(draggedElement, afterElement);
        }
    });

    listElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        const newOrder = Array.from(listElement.querySelectorAll(itemSelector)).map(item => item.dataset.path || item.dataset.id);
        onDropCallback(newOrder);
    });
}

/**
 * Ativa a funcionalidade de "scrub" para inputs numéricos com a classe de label correspondente.
 */
function initScrubbableInputs() {
    let isScrubbing = false;
    let startX = 0;
    let startValue = 0;
    let currentInput = null;

    document.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('scrubbable-label')) {
            currentInput = e.target.nextElementSibling;
            if (currentInput && currentInput.tagName === 'INPUT') {
                isScrubbing = true;
                startX = e.clientX;
                startValue = parseFloat(currentInput.value) || 0;
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isScrubbing && currentInput) {
            const dx = e.clientX - startX;
            const step = parseFloat(currentInput.step) || 1;
            const newValue = startValue + Math.round(dx / 5) * step;
            currentInput.value = newValue;
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    document.addEventListener('mouseup', () => {
        if (isScrubbing) {
            isScrubbing = false;
            currentInput = null;
            document.body.style.cursor = 'default';
        }
    });
}



/**
 * Inicializa a lógica de arrastar e soltar para os painéis do SUPERLED,
 * permitindo mover itens entre os painéis e reordená-los dentro de um mesmo painel.
 */
function initSuperLedDragAndDrop() {
    let draggedItemData = null; // Armazena { video, sourcePanel }

    const getDragAfterElement = (container, y) => {
        const draggableElements = [...container.querySelectorAll(`.video-item:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    dom.superLedPanelContainers.forEach(container => {
        const queueList = container.querySelector('.panel-queue-list');

        queueList.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.video-item');
            if (!item || state.isSuperLedProcessing) return;

            const sourcePanel = item.closest('.panel-container').dataset.panel;
            const videoPath = item.dataset.path;
            const video = state.superLedPanels[sourcePanel].find(v => v.path === videoPath);

            if (video) {
                draggedItemData = { video, sourcePanel };
                setTimeout(() => item.classList.add('dragging'), 0);
            }
        });

        queueList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const isFull = state.superLedPanels[container.dataset.panel].length >= 3;
            const isSamePanel = draggedItemData && draggedItemData.sourcePanel === container.dataset.panel;
            if (draggedItemData && (!isFull || isSamePanel)) {
                 queueList.classList.add('dragover');
            }
        });
        
        queueList.addEventListener('dragleave', (e) => {
            e.preventDefault();
            queueList.classList.remove('dragover');
        });

        queueList.addEventListener('drop', (e) => {
            e.preventDefault();
            queueList.classList.remove('dragover');
            if (!draggedItemData) return;

            const destPanelName = container.dataset.panel;
            const { video, sourcePanel } = draggedItemData;
            
            // Aborta se estiver tentando mover para um painel diferente que já está cheio.
            if (sourcePanel !== destPanelName && state.superLedPanels[destPanelName].length >= 3) {
                return;
            }

            // 1. Atualiza o estado primeiro
            // Remove o vídeo do painel de origem
            state.superLedPanels[sourcePanel] = state.superLedPanels[sourcePanel].filter(v => v.path !== video.path);

            // Adiciona o vídeo ao painel de destino na posição correta
            const afterElement = getDragAfterElement(queueList, e.clientY);
            const destArray = state.superLedPanels[destPanelName];
            
            if (afterElement) {
                const afterPath = afterElement.dataset.path;
                const insertIndex = destArray.findIndex(v => v.path === afterPath);
                destArray.splice(insertIndex, 0, video);
            } else {
                destArray.push(video);
            }

            // 2. Re-renderiza a UI a partir do estado atualizado
            superLedUi.renderAllPanels();
        });
    });

    document.addEventListener('dragend', () => {
        const draggedDOMItem = document.querySelector('.video-item.dragging');
        if (draggedDOMItem) {
            draggedDOMItem.classList.remove('dragging');
        }
        draggedItemData = null;
    });
}

// --- Funções de Inicialização de Eventos Principais ---

function initTabEventListeners() {
    dom.tabConverterBtn.addEventListener('click', () => {
        state.setActiveTab('converter');
        dom.converterView.style.display = 'flex';
        dom.superLedView.style.display = 'none';
        dom.tabConverterBtn.classList.add('active');
        dom.tabSuperLedBtn.classList.remove('active');
        
        dom.appWrapper.classList.remove('sidebar-retracted');
        dom.sidebarControls.style.display = 'flex';
        dom.presetsCheckboxList.closest('.sidebar-content').style.display = 'flex';
    });

    dom.tabSuperLedBtn.addEventListener('click', () => {
        state.setActiveTab('superled');
        dom.converterView.style.display = 'none';
        dom.superLedView.style.display = 'flex';
        dom.tabConverterBtn.classList.remove('active');
        dom.tabSuperLedBtn.classList.add('active');
        
        dom.appWrapper.classList.add('sidebar-retracted');
        dom.sidebarControls.style.display = 'none';
        dom.presetsCheckboxList.closest('.sidebar-content').style.display = 'none';
    });
}

function initConverterEventListeners() {
    dom.dropZone.addEventListener('click', () => window.electronAPI.openFileDialog());
    dom.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dom.dropZone.classList.add('bg-white/5'); });
    dom.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dom.dropZone.classList.remove('bg-white/5'); });
    dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation();
        dom.dropZone.classList.remove('bg-white/5');
        const paths = Array.from(e.dataTransfer.files).map(f => f.path);
        if (paths.length > 0) window.electronAPI.sendDroppedPaths({ paths });
    });

    dom.startBtn.addEventListener('click', () => ui.startQueue());
    dom.pauseBtn.addEventListener('click', () => ui.togglePause());
    dom.cancelBtn.addEventListener('click', () => window.electronAPI.cancelQueue());
    dom.clearQueueBtn.addEventListener('click', () => {
        state.setVideoQueue([]);
        state.setFinalLogContent('');
        ui.updateQueueUI();
    });
    dom.queueList.addEventListener('click', (event) => ui.handleQueueItemClick(event));
}

function initSuperLedEventListeners() {
    dom.superLedPanelContainers.forEach(container => {
        const panelName = container.dataset.panel;
        const dropZone = container.querySelector('.panel-drop-zone');
        const queueList = container.querySelector('.panel-queue-list');

        dropZone.addEventListener('click', () => window.electronAPI.openFileDialog({ forPanel: panelName }));
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.classList.remove('dragover');
            const paths = Array.from(e.dataTransfer.files).map(f => f.path);
            if (paths.length > 0) window.electronAPI.sendDroppedPaths({ paths, panel: panelName });
        });
        
        queueList.addEventListener('click', (event) => {
            const button = event.target.closest('.queue-btn[data-action="delete"]');
            if (!button || button.disabled) return;
            const videoItem = button.closest('.video-item');
            const filePath = videoItem.dataset.path;
            const currentVideos = state.superLedPanels[panelName];
            state.setSuperLedPanelVideos(panelName, currentVideos.filter(v => v.path !== filePath));
            superLedUi.renderAllPanels();
        });
    });

    dom.startSuperLedBtn.addEventListener('click', () => {
        state.setIsSuperLedProcessing(true);
        superLedUi.updateSuperLedButtonState();
        state.setSuperLedLog('');
        dom.superLedLogOutput.textContent = '';
        dom.superLedProgressBar.classList.remove('completed', 'error');

        window.electronAPI.startSuperLed({
            left: state.superLedPanels.left,
            center: state.superLedPanels.center,
            right: state.superLedPanels.right,
            clientName: dom.clientNameInput.value
        });
    });
}

function initModalEventListeners() {
    dom.logBtn.addEventListener('click', () => ui.showLogModal());
    dom.managePresetsBtn.addEventListener('click', () => ui.showPresetsModal());
    dom.settingsBtn.addEventListener('click', () => ui.showSettingsModal());

    dom.logModalCloseBtn.addEventListener('click', () => dom.logModal.style.display = 'none');
    dom.presetsModalCloseBtn.addEventListener('click', () => dom.presetsModal.style.display = 'none');
    dom.settingsModalCloseBtn.addEventListener('click', () => dom.settingsModal.style.display = 'none');
    
    // Listeners do modal de configurações
    dom.languageSelect.addEventListener('change', (event) => window.electronAPI.setSetting('language', event.target.value));
    dom.encoderPresetSelect.addEventListener('change', (event) => window.electronAPI.setSetting('encoderPreset', event.target.value));
    dom.qualityFactorSlider.addEventListener('change', (event) => window.electronAPI.setSetting('qualityFactor', parseInt(event.target.value, 10)));
    dom.qualityFactorSlider.addEventListener('input', (event) => { dom.qualityFactorValue.textContent = event.target.value; });
    dom.checkForUpdatesBtn.addEventListener('click', () => window.electronAPI.checkForUpdates());

    // Listeners do modal de presets
    dom.addNewPresetBtn.addEventListener('click', () => {
        const newPreset = { id: `preset_${Date.now()}`, name: 'Novo Preset', width: 1920, height: 1080, duration: 10, applyBar: false, letterbox: false, barSize: 0, ratioTolerance: 0.2, useOriginalDuration: false };
        state.setPresets([...state.presets, newPreset]);
        window.electronAPI.savePresets(state.presets);
        ui.renderSavedPresetsList();
        ui.populateFormWithPreset(newPreset);
        ui.renderPresetCheckboxes();
    });

    dom.deletePresetBtn.addEventListener('click', async () => {
        if (!state.activePresetId) return;
        const confirmed = await ui.showConfirm({ titleKey: 'confirmDeleteTitle', messageKey: 'confirmDeletePreset', confirmKey: 'delete', cancelKey: 'cancel' });
        if (confirmed) {
            state.setPresets(state.presets.filter(p => p.id !== state.activePresetId));
            await window.electronAPI.savePresets(state.presets);
            ui.resetPresetForm();
            ui.renderPresetCheckboxes();
            ui.updatePresetAvailability();
        }
    });

    const handlePresetFormChange = () => {
        const id = dom.presetForm.querySelector('#preset-id').value;
        if (!id) return;
        const updatedPresetData = {
            id: id,
            name: dom.presetForm.querySelector('#preset-name').value,
            width: parseInt(dom.presetForm.querySelector('#preset-width').value, 10) || 0,
            height: parseInt(dom.presetForm.querySelector('#preset-height').value, 10) || 0,
            duration: parseInt(dom.presetForm.querySelector('#preset-duration').value, 10) || 0,
            applyBar: dom.presetForm.querySelector('#preset-applyBar').checked,
            letterbox: dom.presetForm.querySelector('#preset-letterbox').checked,
            barSize: parseInt(dom.presetForm.querySelector('#preset-barSize').value, 10) || 0,
            ratioTolerance: (parseFloat(dom.presetForm.querySelector('#preset-ratioTolerance').value) || 20) / 100,
            useOriginalDuration: dom.presetForm.querySelector('#preset-useOriginalDuration').checked,
        };
        const updatedPresets = state.presets.map(p => p.id === id ? updatedPresetData : p);
        state.setPresets(updatedPresets);
        window.electronAPI.savePresets(state.presets);
        const listItem = dom.savedPresetsList.querySelector(`[data-id="${id}"]`);
        if (listItem) listItem.querySelector('span').textContent = updatedPresetData.name;
        ui.renderPresetCheckboxes();
    };
    dom.presetForm.addEventListener('input', handlePresetFormChange);

    dom.importPresetsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.importPresets();
        if (result && !result.success) ui.showAlert('importErrorTitle', result.messageKey);
    });
    dom.exportPresetsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.exportPresets();
        if (result && !result.success) ui.showAlert('exportErrorTitle', result.messageKey);
    });
}

function initWindowEventListeners() {
    dom.closeWindowBtn.addEventListener('click', () => {
        dom.appWrapper.classList.add('app-closing');
        setTimeout(() => window.electronAPI.closeWindow(), 200);
    });
    dom.minimizeWindowBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
    dom.maximizeWindowBtn.addEventListener('click', () => window.electronAPI.maximizeWindow());
    dom.sidebarToggleBtn.addEventListener('click', () => dom.appWrapper.classList.toggle('sidebar-retracted'));
}

/**
 * Função principal que inicializa todos os event listeners da aplicação.
 */
export function initEventListeners() {
    initTabEventListeners();
    initConverterEventListeners();
    initSuperLedEventListeners();
    initModalEventListeners();
    initWindowEventListeners();
    initScrubbableInputs();

    // Inicializa o Drag and Drop para as listas do CONVERSOR
    initDragAndDrop(dom.queueList, '.video-item', (newOrder) => {
        state.setVideoQueue(newOrder.map(path => state.videoQueue.find(v => v.path === path)));
        ui.updateQueueUI();
    });

    initDragAndDrop(dom.savedPresetsList, '.saved-preset-item', (newOrder) => {
        const newPresets = newOrder.map(id => state.presets.find(p => p.id === id));
        state.setPresets(newPresets);
        window.electronAPI.savePresets(newPresets);
        ui.renderPresetCheckboxes();
        ui.renderSavedPresetsList();
    });

    initDragAndDrop(dom.presetsCheckboxList, '.preset-checkbox-label', (newOrder) => {
        const newPresets = newOrder.map(id => state.presets.find(p => p.id === id));
        state.setPresets(newPresets);
        window.electronAPI.savePresets(newPresets);
        ui.renderPresetCheckboxes();
        ui.renderSavedPresetsList();
    });

    // Inicializa o Drag and Drop para os painéis do SUPERLED
    initSuperLedDragAndDrop();
}
