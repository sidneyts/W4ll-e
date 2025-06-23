// Módulos Node.js e Electron Apenas um show
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util');
const os = require('os');
const { exec } = require('child_process');

const execPromise = util.promisify(exec);
const fsPromises = fs.promises;

// --- Configuração FFMPEG ---
const FFMPEG = "ffmpeg";
const FFPROBE = "ffprobe";

// --- Variáveis Globais ---
let mainWindow;
let logFilePath = null; // Caminho para o arquivo de log da sessão

// --- Funções de Comunicação com a Interface ---

function sendLog(message, type = 'info') {
    // Envia para a interface
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-log', { message, type });
    }
    // Grava no arquivo de log
    if (logFilePath) {
        const formattedMessage = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${message}\n`;
        fs.appendFile(logFilePath, formattedMessage, (err) => {
            if (err) console.error("Falha ao gravar no arquivo de log:", err);
        });
    }
}

function sendProgress(filePath, progress) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-file-progress', { filePath, progress });
    }
}

function sendStatus(filePath, status) {
     if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-file-status', { filePath, status });
    }
}

// --- Lógica de Renderização de Vídeo (Suas Funções Adaptadas) ---

async function getAndTestBestEncoder() {
    const cpuFallback = { codec: 'libx264', quality: '-preset slow -crf 18' };
    try {
        const { stdout } = await execPromise(`${FFMPEG.split(' ')[0]} -encoders`);
        const availableEncoders = stdout;
        const platform = os.platform();
        let priority = [];
        if (platform === 'darwin') {
            priority = [{ name: 'h264_videotoolbox', quality: '-b:v 4M' }];
        } else if (platform === 'win32') {
            priority = [
                { name: 'h264_nvenc', quality: '-preset hq -cq 23' },
                { name: 'h264_amf', quality: '-quality quality -rc cqp -qp_b 23 -qp_i 23 -qp_p 23' },
                { name: 'h264_qsv', quality: '-global_quality 23' },
            ];
        }
        for (const encoder of priority) {
            if (availableEncoders.includes(encoder.name)) {
                sendLog(`ℹ️ Codificador de hardware (GPU) detectado: ${encoder.name}. Testando...`);
                const testOutputFile = path.join(os.tmpdir(), `test_${Date.now()}.mp4`);
                const testCommand = `${FFMPEG} -f lavfi -i nullsrc=s=640x480:d=1 -c:v ${encoder.name} ${encoder.quality} -y "${testOutputFile}"`;
                try {
                    await execPromise(testCommand);
                    if (fs.existsSync(testOutputFile)) fs.unlinkSync(testOutputFile);
                    sendLog(`✅ Teste da GPU bem-sucedido. Usando ${encoder.name}.`, 'success');
                    return { codec: encoder.name, quality: encoder.quality };
                } catch (testError) {
                    sendLog(`⚠️ Falha ao testar ${encoder.name}. Tentando o próximo...`, 'warning');
                    if (fs.existsSync(testOutputFile)) fs.unlinkSync(testOutputFile);
                }
            }
        }
    } catch (error) {
        sendLog('⚠️ Não foi possível verificar os encoders do FFmpeg.', 'warning');
    }
    sendLog('ℹ️ Nenhum codificador de GPU funcional encontrado. Usando CPU (libx264).');
    return cpuFallback;
}

async function getVideoInfo(filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
    const { stdout } = await execPromise(`${FFPROBE} -v quiet -print_format json -show_streams -show_format "${filePath}"`);
    const info = JSON.parse(stdout);
    const stream = info.streams.find(s => s.codec_type === 'video');
    if (!stream) {
      sendLog(`Aviso: Stream de vídeo não encontrado em ${path.basename(filePath)}`, 'warning');
      return null;
    }
    const duration = info.format && info.format.duration ? parseFloat(info.format.duration) : 10.0;
    return { width: stream.width, height: stream.height, duration: duration };
  } catch (err) {
    if (!/desktop\.ini/i.test(filePath)) {
      sendLog(`Erro ao obter informações de ${path.basename(filePath)}.`, 'error');
    }
    return null;
  }
}

function isStandardVideo(width, height, duration) {
    const ratio = width / height;
    const segundos = Math.round(duration);
    const isSuperLed = width === 3648 && height === 1152;
    if ((segundos < 8 || segundos > 17) && !isSuperLed) return false;
    if (Math.abs(ratio - (1920 / 1080)) < 0.3) return true;
    if (Math.abs(ratio - (960 / 1344)) < 0.05) return true;
    if (Math.abs(ratio - (1080 / 1920)) < 0.3) return true;
    if (Math.abs(ratio - (2048 / 720)) < 0.05) return true;
    if (Math.abs(ratio - (800 / 600)) < 0.3) return true;
    if (Math.abs(ratio - (1920 / 540)) < 0.05) return true;
    if (Math.abs(ratio - (3360 / 240)) < 0.05) return true;
    return false;
}

async function aplicarBarra(input, width, height, outputPath, encoderConfig) {
    let filter = null;
    const videoInfo = await getVideoInfo(input);
    if (!videoInfo) return false;
    const segundos = Math.round(videoInfo.duration);
    if (width == 608 && height == 1080 && segundos === 10) filter = 'scale=608:1005,pad=608:1080:0:0:color=black,setsar=1[out]';
    else if (width == 1080 && height == 1920 && segundos === 10) filter = 'scale=1080:1845,pad=1080:1920:0:0:color=black,setsar=1[out]';
    else if (width == 1280 && height >= 640 && height <= 720 && segundos === 10) filter = 'scale=1280:645,pad=1280:720:0:0:color=black,setsar=1[out]';
    else if (width == 1920 && height == 1080 && segundos === 10) filter = 'scale=1920:1005,pad=1920:1080:0:0:color=black,setsar=1[out]';
    else if (width == 800 && height == 600 && segundos === 10) filter = 'scale=800:540,pad=800:600:0:0:color=black,setsar=1[out]';
    else return false;

    try {
        const command = `${FFMPEG} -i "${input}" -filter_complex "${filter}" -map "[out]" -r 30 -c:v ${encoderConfig.codec} ${encoderConfig.quality} -an -y "${outputPath}"`;
        await execPromise(command);
        return fs.existsSync(outputPath);
    } catch (error) {
        sendLog(`Erro ao aplicar barra em ${path.basename(input)}: ${error.message}`, 'error');
        return false;
    }
}

async function gerarFormatosBase(input, width, height, outputDir, encoderConfig) {
    const generated = { created: [], paths: {} };
    const ratio = width / height;
    const originalBaseName = path.parse(input).name.replace(/_temp_from_image$/, '');
    const createAndLog = async (formatKey, command, duration = 10) => {
        const outputPath = path.join(outputDir, `${originalBaseName}_${formatKey}.mp4`);
        try {
            const fullCommand = `${FFMPEG} -i "${input}" ${command} -t ${duration} -y -r 30 -c:v ${encoderConfig.codec} ${encoderConfig.quality} -an "${outputPath}"`;
            await execPromise(fullCommand);
            sendLog(`Formato base criado: ${path.basename(outputPath)}`, 'info');
            generated.created.push(formatKey);
            generated.paths[formatKey] = outputPath;
        } catch (e) {
            sendLog(`Falha ao gerar ${formatKey}: ${e.message}`, 'error');
        }
    };
    if (Math.abs(ratio - (1920 / 1080)) < 0.3) await createAndLog('WIDEFULLHD', `-vf "scale=1920:1080:force_original_aspect_ratio=disable,setsar=1"`);
    else if (Math.abs(ratio - (960 / 1344)) < 0.05) await createAndLog('TOTEMG', `-vf "scale=960:1344:force_original_aspect_ratio=disable,setsar=1"`);
    else if (Math.abs(ratio - (1080 / 1920)) < 0.3) await createAndLog('VERTFULLHD', `-vf "scale=1080:1920:force_original_aspect_ratio=disable,setsar=1"`);
    else if (Math.abs(ratio - (2048 / 720)) < 0.05) await createAndLog('MUB-FOR-SP', `-vf "scale=2048:720:force_original_aspect_ratio=decrease,pad=2048:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"`);
    else if (Math.abs(ratio - (800 / 600)) < 0.3) await createAndLog('BOX', `-vf "scale=800:600:force_original_aspect_ratio=disable,setsar=1"`);
    else if (Math.abs(ratio - (1920 / 540)) < 0.05) await createAndLog('WALL', `-vf "scale=1920:540:force_original_aspect_ratio=disable,setsar=1"`);
    else if (Math.abs(ratio - (3360 / 240)) < 0.05) await createAndLog('LED', `-vf "scale=3360:240:force_original_aspect_ratio=disable,setsar=1"`);
    return generated;
}

async function gerarFormatosSecundarios(baseResults, outputDir, terSourcePath, allBaseFormats, encoderConfig) {
    if (Object.keys(baseResults.paths).length === 0) return [];
    const gerados = [];
    const creationPromises = [];
    const createAndLog = (outputPath, command, applyBar = true) => {
        const promise = execPromise(command)
            .then(() => {
                sendLog(`Formato secundário criado: ${path.basename(outputPath)}`, 'info');
                gerados.push({ path: outputPath, applyBar });
            })
            .catch(e => sendLog(`Falha ao gerar ${path.basename(outputPath)}: ${e.message}`, 'error'));
        creationPromises.push(promise);
    };
    for (const formatKey in baseResults.paths) {
        const basePath = baseResults.paths[formatKey];
        const originalBaseName = path.parse(basePath).name.replace(`_${formatKey}`, '');
        const ext = '.mp4';
        const out = (suffix) => path.join(outputDir, `${originalBaseName}_${suffix}${ext}`);
        const encoderCmd = `-c:v ${encoderConfig.codec} ${encoderConfig.quality} -an`;
        switch(formatKey) {
            case 'WIDEFULLHD':
                const terSource = terSourcePath || basePath;
                createAndLog(out('TER'), `${FFMPEG} -stream_loop -1 -i "${terSource}" -vf "scale=1280:720,setsar=1" -t 15 -y -r 30 ${encoderCmd} "${out('TER')}"`);
                createAndLog(out('WIDE'), `${FFMPEG} -i "${basePath}" -vf "scale=1280:720,setsar=1" -t 10 -y -r 30 ${encoderCmd} "${out('WIDE')}"`);
                if (!allBaseFormats.has('BOX')) {
                    sendLog(`Formato BOX não encontrado. Gerando a partir do WIDE...`, 'info');
                    createAndLog(out('BOX'), `${FFMPEG} -i "${basePath}" -vf "scale=800:600:force_original_aspect_ratio=decrease,pad=800:600:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1" -t 10 -y -r 30 ${encoderCmd} "${out('BOX')}"`, false);
                } else {
                    sendLog(`Formato BOX já existe. Pulando geração.`, 'info');
                }
                break;
            case 'VERTFULLHD':
                createAndLog(out('VERT'), `${FFMPEG} -i "${basePath}" -vf "scale=608:1080,setsar=1" -t 10 -y -r 30 ${encoderCmd} "${out('VERT')}"`);
                break;
            case 'MUB-FOR-SP':
                createAndLog(out('LED4'), `${FFMPEG} -i "${basePath}" -vf "scale=864:288,setsar=1" -t 10 -y -r 30 ${encoderCmd} "${out('LED4')}"`);
                break;
        }
    }
    await Promise.all(creationPromises);
    return gerados;
}

async function processarArquivo(originalInputPath, outputDir, tempDir, terSourcePath, allBaseFormats, encoderConfig, filesToDelete) {
    const originalFileName = path.basename(originalInputPath);
    const pathInTemp = path.join(tempDir, originalFileName);
    let tempImageVideoFiles = []; // Arquivos temporários criados a partir de imagens

    try {
        await fsPromises.rename(originalInputPath, pathInTemp);
        sendLog(`Arquivo movido para temp: ${originalFileName}`, 'info');

        let caminhoProcessado = pathInTemp;
        const allGeneratedFiles = [];
        if (/\.(jpg|jpeg|png)$/i.test(caminhoProcessado)) {
            sendLog(`Imagem detetada. Convertendo para vídeo...`, 'start-file');
            const tempVideoPath = path.join(outputDir, `${path.parse(caminhoProcessado).name}_temp_from_image.mp4`);
            tempImageVideoFiles.push(tempVideoPath);
            const cmd = `${FFMPEG} -loop 1 -i "${caminhoProcessado}" -t 10 -vf "fps=30,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1" -c:v ${encoderConfig.codec} ${encoderConfig.quality} -y "${tempVideoPath}"`;
            await execPromise(cmd);
            caminhoProcessado = tempVideoPath;
        }
        sendProgress(originalInputPath, 20);

        const videoInfo = await getVideoInfo(caminhoProcessado);
        if (!videoInfo) throw new Error(`Não foi possível obter informações do vídeo para ${path.basename(caminhoProcessado)}`);

        if (!isStandardVideo(videoInfo.width, videoInfo.height, videoInfo.duration)) {
            sendLog(`Formato/duração não padrão para ${path.basename(caminhoProcessado)}. Copiando...`, 'warning');
            const destPath = path.join(outputDir, path.basename(caminhoProcessado));
            if (caminhoProcessado !== destPath) {
                fs.copyFileSync(caminhoProcessado, destPath);
            }
            return;
        }
        
        sendLog(`Iniciando geração de formatos base...`, 'info');
        const baseResults = await gerarFormatosBase(caminhoProcessado, videoInfo.width, videoInfo.height, outputDir, encoderConfig);
        sendProgress(originalInputPath, 50);

        sendLog(`Iniciando geração de formatos secundários...`, 'info');
        const secundariosResults = await gerarFormatosSecundarios(baseResults, outputDir, terSourcePath, allBaseFormats, encoderConfig);
        allGeneratedFiles.push(...Object.values(baseResults.paths).map(p => ({ path: p, applyBar: true })));
        allGeneratedFiles.push(...secundariosResults);
        sendProgress(originalInputPath, 75);

        sendLog(`Aplicando barras e cópias finais...`, 'info');
        // Usar loop sequencial para evitar race conditions
        for (const fileInfo of allGeneratedFiles) {
            if (!fs.existsSync(fileInfo.path)) continue;
            
            const { name, ext } = path.parse(fileInfo.path);
            const tempPathOriginal = fileInfo.path;
            
            // 1. Criar cópia MUP primeiro
            if (name.endsWith('_VERTFULLHD')) {
                const mupName = name.replace('_VERTFULLHD', '_*MUP') + ext;
                const mupFinalPath = path.join(outputDir, mupName);
                sendLog(`Criando cópia MUP: ${path.basename(mupFinalPath)}`, 'info');
                try {
                    fs.copyFileSync(tempPathOriginal, mupFinalPath);
                } catch(copyError) {
                     sendLog(`Erro ao criar cópia MUP para ${name}: ${copyError.message}`, 'error');
                }
            }

            // Adiciona arquivo intermediário à lista para apagar
            tempImageVideoFiles.push(tempPathOriginal);
            
            // 2. Aplicar barra ou renomear
            const barraPath = path.join(outputDir, `${name}_BAR.mp4`);
            const info = await getVideoInfo(tempPathOriginal);
            
            if (fileInfo.applyBar && info && await aplicarBarra(tempPathOriginal, info.width, info.height, barraPath, encoderConfig)) {
                sendLog(`Barra aplicada em: ${path.basename(barraPath)}`, 'done');
            } else {
                sendLog(`Nenhuma barra necessária para: ${path.basename(tempPathOriginal)}`, 'info');
                try {
                    fs.renameSync(tempPathOriginal, barraPath);
                    // Se renomeou com sucesso, não precisa apagar depois
                    const index = tempImageVideoFiles.indexOf(tempPathOriginal);
                    if (index > -1) tempImageVideoFiles.splice(index, 1);
                } catch (renameError) {
                    sendLog(`Erro ao renomear ${name} para versão _BAR: ${renameError.message}`, 'error');
                }
            }
        }
    } catch (erro) {
        sendLog(`Erro fatal ao processar ${originalFileName}: ${erro.message}`, 'error');
        throw erro;
    } finally {
        sendLog(`Limpando arquivos temporários da renderização...`, 'info');
        tempImageVideoFiles.forEach((file) => {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch (e) { /* Ignora */ }
            }
        });
    }
}

async function startVideoProcessing(filePaths) {
    if (!filePaths || filePaths.length === 0) {
        sendLog("Nenhum arquivo na fila para processar.", "warning");
        if (mainWindow) mainWindow.webContents.send('processing-finished');
        return;
    }

    const outputDir = path.dirname(filePaths[0]);
    const tempDir = path.join(outputDir, 'temp');

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    logFilePath = path.join(outputDir, 'W4ll-e-Log.txt');
    sendLog(`--- Iniciando nova sessão de renderização em ${new Date().toLocaleString()} ---`);
    sendLog(`Pasta de trabalho definida como: ${outputDir}`);
    
    const encoderConfig = await getAndTestBestEncoder();

    const allBaseFormats = new Set();
    const videoInputFiles = filePaths.filter(file => /\.(mp4|mov|mkv|avi|webm)$/i.test(file));
    sendLog('Analisando formatos de vídeo de entrada...');
    for (const inputPath of videoInputFiles) {
        const info = await getVideoInfo(inputPath);
        if (!info) continue;
        const ratio = info.width / info.height;
        if (Math.abs(ratio - (1920 / 1080)) < 0.3) allBaseFormats.add('WIDEFULLHD');
        else if (Math.abs(ratio - (960 / 1344)) < 0.05) allBaseFormats.add('TOTEMG');
        else if (Math.abs(ratio - (1080 / 1920)) < 0.3) allBaseFormats.add('VERTFULLHD');
        else if (Math.abs(ratio - (800 / 600)) < 0.3) allBaseFormats.add('BOX');
        else if (Math.abs(ratio - (2048 / 720)) < 0.05) allBaseFormats.add('MUB-FOR-SP');
    }

    const findSpecialTerVideo = async () => {
        for (const file of filePaths) {
            if (!/\.(mp4|mov|mkv|avi|webm)$/i.test(file)) continue;
            const info = await getVideoInfo(file);
            if (!info) continue;
            const ratio = info.width / info.height;
            const is16x9 = Math.abs(ratio - (16 / 9)) < 0.02;
            const isTerDuration = info.duration >= 14 && info.duration <= 16;
            if (is16x9 && isTerDuration) return file;
        }
        return null;
    };
    const terSourcePath = await findSpecialTerVideo();
    const filesToDelete = new Set();
    
    let processedCount = 0;
    for (const filePath of filePaths) {
        sendLog(`Processando ${path.basename(filePath)} | ${processedCount + 1} de ${filePaths.length}`, 'info');
        try {
            await processarArquivo(filePath, outputDir, tempDir, terSourcePath, allBaseFormats, encoderConfig, filesToDelete);
            sendProgress(filePath, 100);
            sendStatus(filePath, 'done');
            sendLog(`Sucesso ao processar: ${path.basename(filePath)}`, 'done');
        } catch (error) {
            sendStatus(filePath, 'error');
        }
        processedCount++;
    }

    if (terSourcePath && !allBaseFormats.has('WIDEFULLHD')) {
        sendLog(`Processando fonte TER especial separadamente...`, 'info');
        filesToDelete.add(terSourcePath);
        const outTer = path.join(outputDir, `${path.parse(terSourcePath).name}_TER.mp4`);
        const outTerBar = path.join(outputDir, `${path.parse(terSourcePath).name}_TER_BAR.mp4`);
        try {
            await execPromise(`${FFMPEG} -stream_loop -1 -i "${terSourcePath}" -vf "scale=1280:720,setsar=1" -t 15 -y -r 30 -c:v ${encoderConfig.codec} ${encoderConfig.quality} -an "${outTer}"`);
            if (await aplicarBarra(outTer, 1280, 720, outTerBar, encoderConfig)) {
                sendLog(`Barra aplicada em: ${path.basename(outTerBar)}`, 'done');
                fs.unlinkSync(outTer);
            } else {
                sendLog(`Nenhuma barra necessária para: ${path.basename(outTer)}`, 'info');
                fs.renameSync(outTer, outTerBar);
            }
        } catch (e) { sendLog(`Falha ao gerar TER especial: ${e.message}`, 'error'); }
    }
    
    sendLog('Fila de processamento concluída.', 'success');
    if (mainWindow) mainWindow.webContents.send('processing-finished');
}

// --- Lógica de Renomeação de Pasta ---

function gerarNomeUnico(pasta, nomeBase, extensao) {
    const nomeBaseSanitizado = nomeBase.replace(/[\\?%*:|"<>]/g, '-');
    let nomeFinal = nomeBaseSanitizado + extensao;
    if (!fs.existsSync(path.join(pasta, nomeFinal))) {
        return nomeFinal;
    }
    let contador = 1;
    while (true) {
        nomeFinal = `${nomeBaseSanitizado}_${contador}${extensao}`;
        if (!fs.existsSync(path.join(pasta, nomeFinal))) {
            return nomeFinal;
        }
        contador++;
    }
}

function getBaseOutputName(width, height, duracao, originalName, dateFormatted, clientName) {
    const segundos = Math.round(duracao);
    const sufixoCliente = clientName || 'C';
    if (width === 1280 && height === 720 && segundos === 15) return `${dateFormatted}_TER_${sufixoCliente}`;
    if (width === 1280 && height === 720 && segundos === 10) return `${dateFormatted}_WIDE_${sufixoCliente}`;
    if (originalName.includes('_*MUP')) return `${dateFormatted}_MUP_${sufixoCliente}`;
    if (width === 1920 && height === 1080 && segundos === 10) return `${dateFormatted}_WIDEFULLHD_${sufixoCliente}`;
    if (width === 1080 && height === 1920 && segundos === 10) return `${dateFormatted}_VERTFULLHD_${sufixoCliente}`;
    if (width === 608 && height === 1080 && segundos === 10) return `${dateFormatted}_VERT_${sufixoCliente}`;
    if (width === 800 && height === 600 && segundos === 10) return `${dateFormatted}_BOX_${sufixoCliente}`;
    if (width === 960 && height === 1344 && segundos === 10) return `${dateFormatted}_TOTEMG_${sufixoCliente}`;
    if (width === 2048 && height === 720 && segundos === 10) return `${dateFormatted}_MUB-FOR-SP_${sufixoCliente}`;
    if (width === 864 && height === 288 && segundos === 10) return `${dateFormatted}_LED4_${sufixoCliente}`;
    if (width === 3648 && height === 1152 && segundos === 30) return `${dateFormatted}_SUPERLED_${sufixoCliente}`;
    if (width === 1920 && height === 540) return `${dateFormatted}_WALL_${sufixoCliente}`;
    if (width === 3360 && height === 240) return `${dateFormatted}_LED_${sufixoCliente}`;
    const nomeOriginalSemExtensao = path.parse(originalName).name;
    return `${dateFormatted}_${width}x${height}_${nomeOriginalSemExtensao}_${segundos}s`;
}

async function renameFilesInFolder(folderPath, clientName) {
    logFilePath = path.join(folderPath, 'W4ll-e-Rename-Log.txt');
    sendLog(`--- Iniciando processo de renomeação em ${new Date().toLocaleString()} ---`);
    sendLog(`Pasta selecionada: ${folderPath}`);
    
    const clientNameToUse = clientName || 'C';
    sendLog(`Nome do cliente definido como: ${clientNameToUse}`);
    
    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const dataFormatada = `${dia}${mes}${ano}`;

    try {
        const arquivos = await fsPromises.readdir(folderPath);
        const arquivosParaProcessar = arquivos.filter(file => /\.(mp4|mov|mkv|avi|webm)$/i.test(file));
        
        if (arquivosParaProcessar.length === 0) {
            sendLog('Nenhum arquivo de vídeo encontrado para renomear.', 'warning');
            return;
        }
        sendLog(`Encontrados ${arquivosParaProcessar.length} arquivos para renomear.`);
        
        for (const originalName of arquivosParaProcessar) {
            const arquivoPath = path.join(folderPath, originalName);
            try {
                const info = await getVideoInfo(arquivoPath);
                if (!info) continue;
                
                const { width, height, duration } = info;
                const extensao = path.extname(originalName);
                
                const nomeBase = getBaseOutputName(width, height, duration, originalName, dataFormatada, clientNameToUse);
                const nomeFinal = gerarNomeUnico(folderPath, nomeBase, extensao);
                const destino = path.join(folderPath, nomeFinal);

                await fsPromises.rename(arquivoPath, destino);
                sendLog(`✅ Renomeado: ${originalName} → ${nomeFinal}`, 'success');
            } catch (err) {
                sendLog(`❌ Erro ao processar ${originalName}: ${err.message}`, 'error');
            }
        }
    } catch (err) {
        sendLog(`❌ Erro ao ler a pasta: ${err.message}`, 'error');
    }
    sendLog('Processo de renomeação concluído.', 'success');
}


// --- Lógica Principal do Electron ---

function createWindow() {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.icns';
    const iconPath = path.join(__dirname, 'build', iconName);

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    if (process.platform === 'darwin') {
        try {
            const iconPath = path.join(__dirname, 'build', 'icon.icns');
            if (fs.existsSync(iconPath)) {
                app.dock.setIcon(iconPath);
            }
        } catch (error) {
            console.error("Falha ao definir o ícone da doca:", error);
        }
    }
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

}).catch(console.error);


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.on('open-file-dialog', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar Arquivos',
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Videos & Imagens', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'jpg', 'jpeg', 'png'] },
            { name: 'Todos os Arquivos', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const files = result.filePaths.map(p => ({ name: path.basename(p), path: p }));
        event.sender.send('files-selected-for-processing', files);
    }
});

ipcMain.on('start-processing-queue', (event, filePaths) => {
    startVideoProcessing(filePaths);
});

ipcMain.on('open-log-file', () => {
    if (logFilePath && fs.existsSync(logFilePath)) {
        shell.openPath(logFilePath);
    } else {
        dialog.showErrorBox('Arquivo de Log não Encontrado', 'Nenhum log foi gerado ainda ou o arquivo foi movido.');
    }
});

ipcMain.on('rename-folder-request', async (event, { clientName }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar Pasta para Renomear',
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        renameFilesInFolder(folderPath, clientName);
    }
});
