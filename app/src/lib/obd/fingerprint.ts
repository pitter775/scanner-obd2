import type { VehicleFingerprint } from '../../types/domain';
import { normalizeHex } from './pids';

const wmiMap: Record<string, { make: string; country: string }> = {
  '9BF': { make: 'Ford', country: 'Brasil' },
  '1FA': { make: 'Ford', country: 'Estados Unidos' },
  '1FB': { make: 'Ford', country: 'Estados Unidos' },
  '1FC': { make: 'Ford', country: 'Estados Unidos' },
  '1FD': { make: 'Ford', country: 'Estados Unidos' },
  '1FM': { make: 'Ford', country: 'Estados Unidos' },
  'WF0': { make: 'Ford', country: 'Europa' },
  '3FA': { make: 'Ford', country: 'Mexico' },
};

const yearMap: Record<string, number> = {
  '6': 2006,
  '7': 2007,
  '8': 2008,
  '9': 2009,
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
};

export function buildFingerprint(raw: VehicleFingerprint['raw']): VehicleFingerprint {
  const vin = parseVin(raw.vin);
  const calibrationIds = parseAsciiFields(raw.calibrationId, '49', '04');
  const cvns = parseHexFields(raw.cvn, '49', '06');
  const ecuNames = parseAsciiFields(raw.ecuName, '49', '0A');
  const vinGuess: { make: string | null; model: string | null; year: number | null } = vin
    ? inferFromVin(vin)
    : { make: null, model: null, year: null };
  const protocol = cleanElmText(raw.protocol);

  return {
    calibrationIds,
    confidence: vin ? 'high' : protocol || calibrationIds.length || ecuNames.length ? 'low' : 'none',
    cvns,
    ecuNames,
    likelyMake: vinGuess.make ?? inferMakeFromText([...calibrationIds, ...ecuNames]),
    likelyModel: vinGuess.model ?? null,
    likelyYear: vinGuess.year ?? null,
    protocol,
    raw,
    supportedPids01: compactRaw(raw.supportedPids01),
    supportedPids21: compactRaw(raw.supportedPids21),
    vin,
  };
}

export function parseVin(rawResponse?: string) {
  const text = parseAsciiFields(rawResponse, '49', '02').join('');
  const vin = text.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();

  if (vin.length >= 17) {
    return vin.slice(-17);
  }

  return null;
}

function inferFromVin(vin: string) {
  const wmi = vin.slice(0, 3);
  const yearCode = vin[9]?.toUpperCase();
  const make = wmiMap[wmi]?.make ?? null;
  const year = yearMap[yearCode] ?? null;

  return {
    make,
    model: make === 'Ford' ? 'Ford detectado por VIN' : null,
    year,
  };
}

function inferMakeFromText(values: string[]) {
  const joined = values.join(' ').toUpperCase();

  if (joined.includes('FORD') || joined.includes('FOCUS')) {
    return 'Ford';
  }

  return null;
}

function parseAsciiFields(rawResponse: string | undefined, mode: string, pid: string) {
  const bytes = normalizeHex(rawResponse ?? '');
  const chunks: string[] = [];

  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index].toUpperCase() !== mode || bytes[index + 1].toUpperCase() !== pid) {
      continue;
    }

    const data = bytes.slice(index + 3);
    const text = data
      .map((byte) => String.fromCharCode(Number.parseInt(byte, 16)))
      .join('')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();

    if (text) {
      chunks.push(text);
    }
  }

  return [...new Set(chunks)];
}

function parseHexFields(rawResponse: string | undefined, mode: string, pid: string) {
  const bytes = normalizeHex(rawResponse ?? '');
  const values: string[] = [];

  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index].toUpperCase() === mode && bytes[index + 1].toUpperCase() === pid) {
      values.push(bytes.slice(index + 3).join('').toUpperCase());
    }
  }

  return [...new Set(values.filter(Boolean))];
}

function cleanElmText(rawResponse?: string) {
  const text = (rawResponse ?? '')
    .replace(/[>\r\n]/g, ' ')
    .replace(/OK/gi, '')
    .trim();

  return text || null;
}

function compactRaw(rawResponse?: string) {
  const value = normalizeHex(rawResponse ?? '').join('').toUpperCase();
  return value || null;
}
