import type { DtcCode } from '../../types/domain';
import { normalizeHex } from './pids';

const systemMap: Record<number, string> = {
  0: 'P',
  1: 'C',
  2: 'B',
  3: 'U',
};

const descriptions: Record<string, string> = {
  P0100: 'Falha no circuito de fluxo de ar',
  P0101: 'Faixa/desempenho do sensor de fluxo de ar',
  P0115: 'Falha no circuito de temperatura do motor',
  P0120: 'Falha no sensor de posicao da borboleta',
  P0130: 'Falha no circuito do sensor de oxigenio',
  P0300: 'Falha de combustao aleatoria detectada',
  P0301: 'Falha de combustao no cilindro 1',
  P0302: 'Falha de combustao no cilindro 2',
  P0420: 'Eficiencia do catalisador abaixo do limite',
};

export function parseDtcResponse(rawResponse: string, status: DtcCode['status']): DtcCode[] {
  const bytes = normalizeHex(rawResponse);
  const modeIndex = bytes.findIndex((byte) => ['43', '47', '4A'].includes(byte.toUpperCase()));

  if (modeIndex < 0) {
    return [];
  }

  const data = bytes.slice(modeIndex + 1);
  const codes: DtcCode[] = [];

  for (let index = 0; index < data.length - 1; index += 2) {
    const first = Number.parseInt(data[index], 16);
    const second = Number.parseInt(data[index + 1], 16);

    if (!first && !second) {
      continue;
    }

    const code = decodeDtcPair(first, second);
    codes.push({
      code,
      description: descriptions[code] ?? 'Descricao ainda nao cadastrada',
      status,
      rawResponse,
    });
  }

  return codes;
}

function decodeDtcPair(first: number, second: number) {
  const system = systemMap[(first & 0xc0) >> 6] ?? 'P';
  const firstDigit = ((first & 0x30) >> 4).toString(16).toUpperCase();
  const secondDigit = (first & 0x0f).toString(16).toUpperCase();
  const thirdDigit = ((second & 0xf0) >> 4).toString(16).toUpperCase();
  const fourthDigit = (second & 0x0f).toString(16).toUpperCase();

  return `${system}${firstDigit}${secondDigit}${thirdDigit}${fourthDigit}`;
}
