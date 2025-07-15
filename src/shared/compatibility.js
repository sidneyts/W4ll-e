// src/shared/compatibility.js

/**
 * Lógica unificada para verificar se um preset é compatível com as informações de um vídeo.
 * Esta função é usada tanto pelo backend (QueueService) quanto pelo frontend (via IPC).
 * @param {object} videoInfo - Informações do vídeo de origem { width, height, duration }.
 * @param {object} preset - O objeto do preset.
 * @returns {boolean} - Retorna true se for compatível.
 */
function isPresetCompatible(videoInfo, preset) {
    // Se não houver informações do vídeo (ex: arquivo corrompido), não é compatível.
    if (!videoInfo) return false;

    const sourceRatio = videoInfo.width / videoInfo.height;
    const presetRatio = preset.width / preset.height;
    
    // Usa a tolerância de proporção do preset, com um fallback para 20% se não definida.
    const ratioTolerance = preset.ratioTolerance !== undefined ? preset.ratioTolerance : 0.2;
    const ratioDiff = Math.abs(sourceRatio - presetRatio);
    const ratioIsCompatible = ratioDiff <= ratioTolerance;

    // Se o preset usa a duração original, a verificação de tempo é sempre compatível.
    // Caso contrário, usa uma tolerância de 2 segundos.
    const timeIsCompatible = preset.useOriginalDuration || (Math.abs(videoInfo.duration - preset.duration) <= 2);

    return ratioIsCompatible && timeIsCompatible;
}

module.exports = {
    isPresetCompatible,
};
