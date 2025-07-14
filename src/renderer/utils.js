// src/renderer/utils.js

/**
 * Cria uma string segura para ser usada como ID de um elemento do DOM a partir de um caminho de arquivo.
 * Substitui caracteres não alfanuméricos por um underscore para evitar erros.
 * @param {string} filePath - O caminho completo para o arquivo.
 * @returns {string} Uma string higienizada e segura para ser usada como ID.
 */
export function createSafeIdForPath(filePath) {
    // Preceder com 'id-' garante que o seletor seja sempre válido, mesmo que o caminho comece com números.
    return 'id-' + filePath.replace(/[^a-zA-Z0-9]/g, '_');
}
