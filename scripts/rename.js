/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const util = require('util');

// Promisify exec para operações assíncronas
const execPromise = util.promisify(exec);

let FFPROBE, FFMPEG_PATH;
try {
  // O caminho agora aponta para a pasta 'utils' dentro do diretório do script
  const utilsPath = path.resolve(__dirname, 'utils', 'ffmpegUtils.js');
  if (!fs.existsSync(utilsPath)) {
      throw new Error(`Ficheiro de configuração não encontrado em: ${utilsPath}`);
  }
  const ffmpegUtils = require(utilsPath);
  FFPROBE = ffmpegUtils.FFPROBE;
  FFMPEG_PATH = ffmpegUtils.FFMPEG.split(' ')[0];
} catch (e) {
  console.warn(`⚠️  Aviso: ${e.message}. Usando padrões.`);
  FFPROBE = 'ffprobe';
  FFMPEG_PATH = 'ffmpeg';
}

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

async function getVideoInfo(filePath) {
  try {
    const { stdout } = await execPromise(`${FFPROBE} -v quiet -print_format json -show_streams -show_format "${filePath}"`);
    const info = JSON.parse(stdout);
    const stream = info.streams.find(s => s.codec_type === 'video');
    if (!stream) return null;
    return {
      width: stream.width,
      height: stream.height,
      duration: parseFloat(info.format.duration)
    };
  } catch (err) {
    console.error(`      - ❌ Erro ao obter informações de ${path.basename(filePath)}.`);
    return null;
  }
}

async function detectBlackBars(filePath, videoWidth, videoHeight, duration) {
    try {
        const analysisTime = duration > 1 ? 1 : 0;
        const command = `${FFMPEG_PATH} -ss ${analysisTime} -i "${filePath}" -t 4 -vf "cropdetect" -f null -`;
        const { stderr } = await execPromise(command);
        const cropRegex = /crop=(\d+):(\d+):(\d+):(\d+)/g;
        let match;
        let lastMatch = null;
        while ((match = cropRegex.exec(stderr)) !== null) {
            lastMatch = match;
        }
        if (lastMatch) {
            const detectedWidth = parseInt(lastMatch[1], 10);
            const detectedHeight = parseInt(lastMatch[2], 10);
            const totalArea = videoWidth * videoHeight;
            const detectedArea = detectedWidth * detectedHeight;
            const blackBarArea = totalArea - detectedArea;
            if ((blackBarArea / totalArea) > 0.01) {
                console.log(`     - 🕵️ Barras detetadas em ${path.basename(filePath)}.`);
                return true;
            }
        }
    } catch (e) {
        // Silencia o erro de cropdetect, pois pode falhar em vídeos muito curtos
    }
    console.log(`     - ✅ Nenhuma barra significativa detetada em ${path.basename(filePath)}.`);
    return false;
}

function getBaseOutputName(width, height, duration, hasBars, dateFormatted, clientName) {
  const segundos = Math.round(duration);
  const sufixoCliente = clientName || 'C';

  if (width === 1920 && height === 1080 && segundos === 10) return `${dateFormatted}_WIDEFULLHD_${sufixoCliente}`;
  if (width === 1280 && height === 720 && segundos === 10) return `${dateFormatted}_WIDE_${sufixoCliente}`;
  if (width === 1280 && height === 720 && segundos === 15) return `${dateFormatted}_TER_${sufixoCliente}`;
  if (width === 800 && height === 600 && segundos === 10) return `${dateFormatted}_BOX_${sufixoCliente}`;
  if (width === 1080 && height === 1920 && segundos === 10 && hasBars) return `${dateFormatted}_VERTFULLHD_${sufixoCliente}`;
  if (width === 1080 && height === 1920 && segundos === 10 && !hasBars) return `${dateFormatted}_MUP_${sufixoCliente}`;
  if (width === 608 && height === 1080 && segundos === 10) return `${dateFormatted}_VERT_${sufixoCliente}`;
  if (width === 2048 && height === 720 && segundos === 10) return `${dateFormatted}_MUB-FOR-SP_${sufixoCliente}`;
  if (width === 864 && height === 288 && segundos === 10) return `${dateFormatted}_LED4_${sufixoCliente}`;
  if (width === 960 && height === 1344 && segundos === 10) return `${dateFormatted}_TOTEMG_${sufixoCliente}`;
  if (width === 1920 && height === 540 && segundos === 10) return `${dateFormatted}_WALL_${sufixoCliente}`;
  if (width === 3360 && height === 240 && segundos === 10) return `${dateFormatted}_LED_${sufixoCliente}`;
  if (width === 3648 && height === 1152 && segundos === 30) return `${dateFormatted}_SUPERLED_${sufixoCliente}`;

  return `${dateFormatted}_UNDEFINED_${width}x${height}_${segundos}s_${sufixoCliente}`;
}

async function main() {
    // Pega os argumentos da linha de comando
    const inputFolder = process.argv[2];
    let clientName = process.argv[3]; // O nome do cliente agora é o terceiro argumento

    if (!clientName || clientName.trim() === '') {
      clientName = 'C';
      console.log("ℹ️  Nenhum nome de cliente fornecido. Usando '_C' como padrão.");
    } else {
      console.log(`ℹ️  Nome do cliente definido como: ${clientName}`);
    }

    if (!inputFolder || !fs.existsSync(inputFolder)) {
      console.error('❌ Pasta de entrada não fornecida ou não encontrada.');
      return;
    }
  
    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const dataFormatada = `${dia}${mes}${ano}`;
  
    const arquivosParaProcessar = fs.readdirSync(inputFolder)
      .filter(file => /\.(mp4|mov|mkv|avi|webm)$/i.test(file))
      .map(file => path.join(inputFolder, file));
  
    if (arquivosParaProcessar.length === 0) {
      console.log('ℹ️  Nenhum arquivo de vídeo encontrado na pasta de output para renomear.');
      return;
    }
  
    console.log(`ℹ️  Encontrados ${arquivosParaProcessar.length} arquivos para renomear.`);
  
    for (const arquivoPath of arquivosParaProcessar) {
      console.log(`\n▶️  Analisando ${path.basename(arquivoPath)}...`);
      try {
        const info = await getVideoInfo(arquivoPath);
        if (!info) continue;
  
        const { width, height, duration } = info;
        const hasBars = await detectBlackBars(arquivoPath, width, height, duration);
        
        const originalName = path.basename(arquivoPath);
        const extensao = path.extname(originalName);
  
        const nomeBase = getBaseOutputName(width, height, duration, hasBars, dataFormatada, clientName);
        const nomeFinal = gerarNomeUnico(inputFolder, nomeBase, extensao);
        const destino = path.join(inputFolder, nomeFinal);

        fs.renameSync(arquivoPath, destino);
        console.log(`✅ Processado: ${originalName} → ${nomeFinal}`);
  
      } catch (err) {
        console.error(`❌ Erro ao processar ${path.basename(arquivoPath)}: ${err.message}`);
      }
    }
}

main();
