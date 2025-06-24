// FALA TESTE
document.addEventListener('DOMContentLoaded', () => {
    const ipcRenderer = window.ipcRenderer;
    if (!ipcRenderer) {
        throw new Error('IPC Renderer not found. This script must run in an Electron environment with a preload script.');
    }

    // --- SELETORES DE ELEMENTOS ---
    const mainView = document.getElementById('main-view');
    const configView = document.getElementById('config-view');
    const goToConfigBtn = document.getElementById('go-to-config-btn');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const queuePanel = document.getElementById('queue-panel');
    const queueList = document.getElementById('queue-list');
    const logList = document.getElementById('log-list-area');
    const clearQueueBtn = document.getElementById('clear-queue-btn');
    const addFilesBtn = document.getElementById('add-files-btn');
    const openLogBtn = document.getElementById('open-log-file-btn');
    const renameFolderBtn = document.getElementById('manual-rename-btn');
    const clientNameInput = document.getElementById('client-name');
    const queueItemTemplate = document.getElementById('queue-item-template');
    
    // Renderiza os ícones do Lucide
    lucide.createIcons();

    // --- LÓGICA DE NAVEGAÇÃO ---
    goToConfigBtn.addEventListener('click', () => {
        mainView.style.display = 'none';
        configView.style.display = 'flex';
    });
    backToMainBtn.addEventListener('click', () => {
        configView.style.display = 'none';
        mainView.style.display = 'flex';
    });

    // --- LÓGICA DA TELA PRINCIPAL (FILA E LOGS) ---
    
    // Inicia o processamento assim que os arquivos são selecionados
    const startProcessing = (files) => {
        if (files.length === 0) {
            addLog('Nenhum arquivo selecionado.', 'warning');
            return;
        }
        
        // Limpa a fila e o log da interface
        queueList.innerHTML = '';
        logList.innerHTML = '';
        
        // Adiciona os novos arquivos à fila na interface
        files.forEach(file => {
            const templateClone = queueItemTemplate.content.cloneNode(true);
            const queueItem = templateClone.querySelector('.queue-item');
            queueItem.dataset.filePath = file.path;
            queueItem.querySelector('.file-name').textContent = file.name;
            queueList.appendChild(queueItem);
        });

        // Desabilita botões e envia para o backend
        toggleUI(false);
        const filePaths = files.map(f => f.path);
        ipcRenderer.send('start-processing-queue', filePaths);
    };

    // Eventos de Drag and Drop
    if (queuePanel) {
        queuePanel.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            queuePanel.classList.add('drag-over');
        });
        queuePanel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            queuePanel.classList.remove('drag-over');
        });
        queuePanel.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            queuePanel.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                const files = Array.from(e.dataTransfer.files).map(file => ({
                    name: file.name,
                    path: file.path
                }));
                startProcessing(files);
            }
        });
    }
    
    // Botão Adicionar Arquivos
    addFilesBtn.addEventListener('click', () => {
        ipcRenderer.send('open-file-dialog');
    });
    
    // Botão Abrir Log
    openLogBtn.addEventListener('click', () => {
        ipcRenderer.send('open-log-file');
    });

    // Botão Renomear Pasta
    renameFolderBtn.addEventListener('click', () => {
        const clientName = clientNameInput.value.trim();
        logList.innerHTML = ''; // Limpa o log para a nova operação
        addLog('Solicitando renomeação de pasta...', 'info');
        ipcRenderer.send('rename-folder-request', { clientName });
    });

    // Botão Limpar Fila
    clearQueueBtn.addEventListener('click', () => {
        queueList.innerHTML = '';
        addLog('Fila limpa pelo usuário.', 'info');
    });
    
    const addLog = (message, type = 'info') => {
        if (!logList) return;
        const li = document.createElement('li');
        li.className = `log-item log-${type}`;
        li.innerHTML = `<span class="log-icon">${getLogIcon(type)}</span> <span>${message}</span>`;
        logList.appendChild(li);
        logList.scrollTop = logList.scrollHeight;
    };

    const getLogIcon = (type) => {
        const icons = { success: '✔', done: '✔', error: '✖', warning: '⚠️', 'start-file': '▶' };
        return icons[type] || 'ℹ️';
    };

    const toggleUI = (enabled) => {
        addFilesBtn.disabled = !enabled;
        clearQueueBtn.disabled = !enabled;
        goToConfigBtn.disabled = !enabled;
        renameFolderBtn.disabled = !enabled;
    }

    // --- LISTENERS IPC (Ouvindo eventos do Backend) ---
    ipcRenderer.on('files-selected-for-processing', (files) => {
        startProcessing(files);
    });

    ipcRenderer.on('update-log', ({ message, type }) => {
        addLog(message, type);
    });

    ipcRenderer.on('update-file-progress', ({ filePath, progress }) => {
        const item = queueList.querySelector(`[data-file-path="${filePath}"]`);
        if (item) {
            const progressBar = item.querySelector('.progress-bar');
            progressBar.style.width = `${progress}%`;
            item.querySelector('.status-text').textContent = `Processando ${progress}%`;
        }
    });

    ipcRenderer.on('update-file-status', ({ filePath, status }) => {
        const item = queueList.querySelector(`[data-file-path="${filePath}"]`);
        if (item) {
            const progressBar = item.querySelector('.progress-bar');
            const statusText = item.querySelector('.status-text');
            if (status === 'done') {
                statusText.textContent = 'Concluído';
                progressBar.className = 'progress-bar status-done';
            } else if (status === 'error') {
                statusText.textContent = 'Erro!';
                progressBar.className = 'progress-bar status-error';
            }
        }
    });
    
    ipcRenderer.on('processing-finished', () => {
        addLog('Processo finalizado.', 'success');
        toggleUI(true); // Reabilita a UI
    });
});
