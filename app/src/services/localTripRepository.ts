import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BluetoothDeviceInfo, LocalTrip, LocalTripPoint, LocalTripSummary, ObdReading, Vehicle } from '../types/domain';

const localTripsKey = '@infrascan/local-trips';
const localTripSummariesKey = '@infrascan/local-trip-summaries';
const fullTripLimit = 12;
const summaryLimit = 180;

export async function fetchLocalTrips() {
  const raw = await AsyncStorage.getItem(localTripsKey);
  if (!raw) {
    return [];
  }

  try {
    const trips = JSON.parse(raw) as LocalTrip[];
    return Array.isArray(trips) ? trips : [];
  } catch {
    return [];
  }
}

export async function fetchLocalTripSummaries() {
  const raw = await AsyncStorage.getItem(localTripSummariesKey);
  if (!raw) {
    return [];
  }

  try {
    const summaries = JSON.parse(raw) as LocalTripSummary[];
    return Array.isArray(summaries) ? summaries : [];
  } catch {
    return [];
  }
}

export async function persistLocalTrips(trips: LocalTrip[]) {
  const fullTrips = trips.slice(0, fullTripLimit);
  const existingSummaries = await fetchLocalTripSummaries();
  const fullIds = new Set(fullTrips.map((trip) => trip.id));
  const nextSummaries = mergeTripSummaries(existingSummaries, trips.map((trip) => summarizeLocalTrip(trip, fullIds.has(trip.id))));

  await Promise.all([
    AsyncStorage.setItem(localTripsKey, JSON.stringify(fullTrips)),
    AsyncStorage.setItem(localTripSummariesKey, JSON.stringify(nextSummaries)),
  ]);

  return {
    localTrips: fullTrips,
    localTripSummaries: nextSummaries,
  };
}

export function createLocalTrip(vehicle?: Vehicle, adapter?: BluetoothDeviceInfo, metadata?: { name?: string; notes?: string | null }): LocalTrip {
  return {
    adapterAddress: adapter?.address ?? null,
    adapterName: adapter?.name ?? null,
    endedAt: null,
    id: `trip-${Date.now()}`,
    name: metadata?.name?.trim() || 'Gravacao sem nome',
    notes: metadata?.notes?.trim() || null,
    points: [],
    startedAt: new Date().toISOString(),
    vehicle: vehicle
      ? {
        engine: vehicle.engine ?? null,
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        vin: vehicle.vin ?? null,
        year: vehicle.year,
      }
      : null,
  };
}

export function createLocalTripPoint(readings: ObdReading[], coordinates?: { latitude: number; longitude: number } | null): LocalTripPoint {
  const engineLoadPercent = numericReading(readings, '0104');
  const manifoldPressureKpa = numericReading(readings, '010B');
  const rpm = numericReading(readings, '010C');
  const throttlePercent = numericReading(readings, '0111');

  return {
    at: new Date().toISOString(),
    coolantTempC: numericReading(readings, '0105'),
    engineEffort: effortScore(engineLoadPercent, manifoldPressureKpa, rpm, throttlePercent),
    engineLoadPercent,
    id: `point-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    manifoldPressureKpa,
    moduleVoltage: numericReading(readings, '0142'),
    rawReadings: readings,
    rpm,
    speedKph: numericReading(readings, '010D'),
    throttlePercent,
  };
}

export function serializeTripExport(trip: LocalTrip) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    format: 'infrascan-local-trip-v1',
    trip,
  }, null, 2);
}

export function serializeTripSummaryExport(summary: LocalTripSummary) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    format: 'infrascan-local-trip-summary-v1',
    summary,
  }, null, 2);
}

export function summarizeLocalTrip(trip: LocalTrip, fullTripAvailable = true): LocalTripSummary {
  return {
    adapterName: trip.adapterName,
    endedAt: trip.endedAt,
    fullTripAvailable,
    gpsPointCount: trip.points.filter((point) => point.latitude != null && point.longitude != null).length,
    id: trip.id,
    maxCoolantTempC: maxValue(trip.points, (point) => point.coolantTempC),
    maxEngineEffort: maxValue(trip.points, (point) => point.engineEffort),
    maxEngineLoadPercent: maxValue(trip.points, (point) => point.engineLoadPercent),
    maxManifoldPressureKpa: maxValue(trip.points, (point) => point.manifoldPressureKpa),
    maxRpm: maxValue(trip.points, (point) => point.rpm),
    maxSpeedKph: maxValue(trip.points, (point) => point.speedKph),
    maxThrottlePercent: maxValue(trip.points, (point) => point.throttlePercent),
    name: trip.name || 'Gravacao sem nome',
    notes: trip.notes ?? null,
    pointCount: trip.points.length,
    startedAt: trip.startedAt,
    vehicle: trip.vehicle,
  };
}

function numericReading(readings: ObdReading[], pid: string) {
  const reading = readings.find((item) => item.pid === pid);
  return typeof reading?.value === 'number' ? reading.value : null;
}

function effortScore(load: number | null, map: number | null, rpm: number | null, throttle: number | null) {
  const values = [
    normalize(load, 100),
    normalize(map, 100),
    normalize(rpm, 6000),
    normalize(throttle, 100),
  ].filter((value) => value != null) as number[];

  if (!values.length) {
    return null;
  }

  return Number(((values.reduce((sum, value) => sum + value, 0) / values.length) * 100).toFixed(1));
}

function normalize(value: number | null, max: number) {
  return typeof value === 'number' ? Math.max(0, Math.min(1, value / max)) : null;
}

function mergeTripSummaries(existing: LocalTripSummary[], incoming: LocalTripSummary[]) {
  const byId = new Map<string, LocalTripSummary>();

  for (const summary of existing) {
    byId.set(summary.id, { ...summary, fullTripAvailable: false });
  }

  for (const summary of incoming) {
    byId.set(summary.id, summary);
  }

  return [...byId.values()]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, summaryLimit);
}

function maxValue(points: LocalTripPoint[], pick: (point: LocalTripPoint) => number | null | undefined) {
  const values = points
    .map((point) => pick(point))
    .filter((value): value is number => typeof value === 'number');

  return values.length ? Math.max(...values) : null;
}
