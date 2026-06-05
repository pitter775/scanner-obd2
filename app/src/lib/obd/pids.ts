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
    unit: '°C',
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
    unit: '°C',
    decode: ([a = 0]) => a - 40,
  },
  {
    pid: '010B',
    name: 'Pressão coletor',
    unit: 'kPa',
    decode: ([a = 0]) => a,
  },
  {
    pid: '0142',
    name: 'Tensão módulo',
    unit: 'V',
    decode: ([a = 0, b = 0]) => ((a * 256) + b) / 1000,
  },
  {
    pid: '0110',
    name: 'Fluxo de ar',
    unit: 'g/s',
    decode: ([a = 0, b = 0]) => ((a * 256) + b) / 100,
  },
  {
    pid: '011F',
    name: 'Tempo ligado',
    unit: 's',
    decode: ([a = 0, b = 0]) => (a * 256) + b,
  },
  {
    pid: '0121',
    name: 'Distancia com falha',
    unit: 'km',
    decode: ([a = 0, b = 0]) => (a * 256) + b,
  },
  {
    pid: '0130',
    name: 'Warm-ups sem apagar',
    unit: 'ciclos',
    decode: ([a = 0]) => a,
  },
  {
    pid: '0131',
    name: 'Distancia sem apagar',
    unit: 'km',
    decode: ([a = 0, b = 0]) => (a * 256) + b,
  },
  {
    pid: '0133',
    name: 'Pressão barométrica',
    unit: 'kPa',
    decode: ([a = 0]) => a,
  },
  {
    pid: '013C',
    name: 'Temperatura catalisador B1S1',
    unit: '°C',
    decode: ([a = 0, b = 0]) => (((a * 256) + b) / 10) - 40,
  },
  {
    pid: '013E',
    name: 'Temperatura catalisador B1S2',
    unit: '°C',
    decode: ([a = 0, b = 0]) => (((a * 256) + b) / 10) - 40,
  },
];

export const realtimeFastPidIds = ['010C', '010D', '0104', '0111'];
export const realtimeSlowPidIds = ['0105', '010B', '010F', '0142'];
export const realtimeFastPids = obdPids.filter((pid) => realtimeFastPidIds.includes(pid.pid));
export const realtimeSlowPids = obdPids.filter((pid) => realtimeSlowPidIds.includes(pid.pid));

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
