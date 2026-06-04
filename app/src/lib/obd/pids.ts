import type { ObdReading } from '../../types/domain';

export type ObdPid = {
  pid: string;
  name: string;
  unit: string;
  decode: (bytes: number[]) => number;
};

export const obdPids: ObdPid[] = [
  {
    pid: '010C',
    name: 'RPM',
    unit: 'rpm',
    decode: ([a = 0, b = 0]) => ((a * 256) + b) / 4,
  },
  {
    pid: '010D',
    name: 'Velocidade',
    unit: 'km/h',
    decode: ([a = 0]) => a,
  },
  {
    pid: '0105',
    name: 'Temperatura do motor',
    unit: 'C',
    decode: ([a = 0]) => a - 40,
  },
  {
    pid: '0104',
    name: 'Carga do motor',
    unit: '%',
    decode: ([a = 0]) => (a * 100) / 255,
  },
  {
    pid: '0111',
    name: 'Borboleta',
    unit: '%',
    decode: ([a = 0]) => (a * 100) / 255,
  },
  {
    pid: '010F',
    name: 'Temperatura do ar',
    unit: 'C',
    decode: ([a = 0]) => a - 40,
  },
  {
    pid: '010B',
    name: 'Pressao coletor',
    unit: 'kPa',
    decode: ([a = 0]) => a,
  },
  {
    pid: '0142',
    name: 'Tensao modulo',
    unit: 'V',
    decode: ([a = 0, b = 0]) => ((a * 256) + b) / 1000,
  },
];

export function getPid(pid: string) {
  return obdPids.find((item) => item.pid === pid);
}

export function parsePidResponse(pid: string, rawResponse: string): ObdReading | null {
  const definition = getPid(pid);
  if (!definition) {
    return null;
  }

  const expectedMode = '41';
  const expectedPid = pid.slice(2);
  const bytes = normalizeHex(rawResponse);
  const start = bytes.findIndex((byte, index) => byte === expectedMode && bytes[index + 1] === expectedPid);

  if (start < 0) {
    return null;
  }

  const dataBytes = bytes.slice(start + 2).map((byte) => Number.parseInt(byte, 16));
  const value = definition.decode(dataBytes);

  return {
    pid,
    name: definition.name,
    unit: definition.unit,
    value: Number(value.toFixed(2)),
    rawResponse,
  };
}

export function normalizeHex(rawResponse: string) {
  return rawResponse
    .replace(/SEARCHING\.\.\./gi, '')
    .replace(/[>\r\n]/g, ' ')
    .trim()
    .split(/\s+/)
    .join('')
    .match(/.{1,2}/g)
    ?.filter((byte) => /^[0-9a-f]{2}$/i.test(byte)) ?? [];
}
