// src/main/services/RenameService.js
const path = require('path');
const FileService = require('./FileService');

/**
 * Gera o nome base para um arquivo de saída com base nas suas propriedades.
 * Esta função substitui a lógica que estava no antigo rename.js.
 * @param {object} preset - O objeto do preset que foi usado para renderizar o vídeo.
 * @param {string} clientName - O nome do cliente fornecido pelo usuário.
 * @returns {string} O nome base do arquivo (sem extensão).
 */
function getBaseOutputName(preset, clientName) {
    const { width, height, duration, applyBar } = preset;
    const segundos = Math.round(duration);
    const sufixoCliente = clientName || 'C';

    const date = new Date();
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const dateFormatted = `${dia}${mes}${ano}`;

    // Regras de nomenclatura baseadas nas propriedades do preset
    if (width === 1920 && height === 1080 && segundos === 10) return `${dateFormatted}_WIDEFULLHD_${sufixoCliente}`;
    if (width === 1280 && height === 720 && segundos === 10) return `${dateFormatted}_WIDE_${sufixoCliente}`;
    if (width === 1280 && height === 720 && segundos === 15) return `${dateFormatted}_TER_${sufixoCliente}`;
    if (width === 800 && height === 600 && segundos === 10) return `${dateFormatted}_BOX_${sufixoCliente}`;
    if (width === 1080 && height === 1920 && segundos === 10) {
        // A detecção de barras pretas foi simplificada. Se o preset aplica a barra, usamos o nome correspondente.
        return applyBar ? `${dateFormatted}_VERTFULLHD_${sufixoCliente}` : `${dateFormatted}_MUP_${sufixoCliente}`;
    }
    if (width === 608 && height === 1080 && segundos === 10) return `${dateFormatted}_VERT_${sufixoCliente}`;
    if (width === 2048 && height === 720 && segundos === 10) return `${dateFormatted}_MUB-FOR-SP_${sufixoCliente}`;
    if (width === 864 && height === 288 && segundos === 10) return `${dateFormatted}_LED4_${sufixoCliente}`;
    if (width === 960 && height === 1344 && segundos === 10) return `${dateFormatted}_TOTEMG_${sufixoCliente}`;
    if (width === 1920 && height === 540 && segundos === 10) return `${dateFormatted}_WALL_${sufixoCliente}`;
    if (width === 3360 && height === 240 && segundos === 10) return `${dateFormatted}_LED_${sufixoCliente}`;
    if (width === 3648 && height === 1152 && segundos === 30) return `${dateFormatted}_SUPERLED_${sufixoCliente}`;

    // Fallback para formatos não definidos
    return `${dateFormatted}_UNDEFINED_${width}x${height}_${segundos}s_${sufixoCliente}`;
}

/**
 * Renomeia um arquivo de saída para seu nome final e único.
 * @param {string} outputFilePath - O caminho do arquivo renderizado (ex: video_temp_WIDE.mp4).
 * @param {object} preset - O preset usado na renderização.
 * @param {string} clientName - O nome do cliente.
 * @returns {Promise<string>} O novo caminho do arquivo renomeado.
 */
async function renameOutputFile(outputFilePath, preset, clientName) {
    const outputDir = path.dirname(outputFilePath);
    const extension = path.extname(outputFilePath);
    
    const baseName = getBaseOutputName(preset, clientName);
    const finalName = FileService.getUniqueFileName(outputDir, baseName, extension);
    
    const finalPath = path.join(outputDir, finalName);
    
    await FileService.moveFile(outputFilePath, finalPath);
    
    return finalName;
}

module.exports = {
    renameOutputFile,
};
