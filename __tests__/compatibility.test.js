// __tests__/compatibility.test.js

// Importa a função que queremos testar
const { isPresetCompatible } = require('../src/shared/compatibility');

// Descreve o conjunto de testes para a função isPresetCompatible
describe('isPresetCompatible', () => {

  // Informações de um vídeo de exemplo (16:9)
  const videoInfo16x9 = { width: 1920, height: 1080, duration: 10.0 };
  // Informações de um vídeo vertical (9:16)
  const videoInfo9x16 = { width: 1080, height: 1920, duration: 15.0 };

  // Teste 1: Deve retornar 'true' para um preset com proporção e duração idênticas
  test('should return true for exact match', () => {
    const preset = { width: 1920, height: 1080, duration: 10.0 };
    expect(isPresetCompatible(videoInfo16x9, preset)).toBe(true);
  });

  // Teste 2: Deve retornar 'true' se a proporção estiver dentro da tolerância padrão (20%)
  test('should return true if ratio is within default tolerance', () => {
    // Um preset um pouco mais largo, mas ainda aceitável
    const preset = { width: 2000, height: 1080, duration: 10.0 }; 
    expect(isPresetCompatible(videoInfo16x9, preset)).toBe(true);
  });

  // Teste 3: Deve retornar 'false' se a proporção estiver fora da tolerância
  test('should return false if ratio is outside tolerance', () => {
    // Um preset quadrado, muito diferente de 16:9
    const preset = { width: 1080, height: 1080, duration: 10.0 }; 
    expect(isPresetCompatible(videoInfo16x9, preset)).toBe(false);
  });

  // Teste 4: Deve respeitar uma tolerância customizada definida no preset
  test('should respect custom ratioTolerance', () => {
    const preset = { width: 1930, height: 1080, duration: 10.0, ratioTolerance: 0.01 }; // Tolerância muito baixa
    expect(isPresetCompatible(videoInfo16x9, preset)).toBe(false); // A pequena diferença agora o torna incompatível
  });

  // Teste 5: Deve retornar 'true' se a duração estiver dentro da tolerância de 2 segundos
  test('should return true if duration is within 2-second tolerance', () => {
    const preset = { width: 1920, height: 1080, duration: 11.5 };
    expect(isPresetCompatible(videoInfo16x9, preset)).toBe(true);
  });

  // Teste 6: Deve retornar 'false' se a duração estiver fora da tolerância
  test('should return false if duration is outside tolerance', () => {
    const preset = { width: 1920, height: 1080, duration: 13.0 };
    expect(isPresetCompatible(videoInfo16x9, preset)).toBe(false);
  });

  // Teste 7: Deve retornar 'true' quando o preset usa a duração original do vídeo
  test('should return true when useOriginalDuration is enabled, regardless of duration difference', () => {
    const preset = { width: 1080, height: 1920, duration: 5.0, useOriginalDuration: true };
    expect(isPresetCompatible(videoInfo9x16, preset)).toBe(true); // A duração do preset é 5s, do vídeo é 15s, mas deve ser compatível
  });

  // Teste 8: Deve funcionar corretamente com vídeos verticais
  test('should work correctly with vertical videos', () => {
    const preset = { width: 1080, height: 1920, duration: 15.0 };
    expect(isPresetCompatible(videoInfo9x16, preset)).toBe(true);
  });

  // Teste 9: Deve retornar 'false' se as informações do vídeo forem nulas
  test('should return false if videoInfo is null', () => {
    const preset = { width: 1920, height: 1080, duration: 10.0 };
    expect(isPresetCompatible(null, preset)).toBe(false);
  });
});
