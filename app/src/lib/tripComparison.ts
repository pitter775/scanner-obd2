import type { LocalTrip, LocalTripPoint } from '../types/domain';

export type TripMetric = {
  id: string;
  label: string;
  unit: string;
  base: number;
  compare: number;
  delta: number;
  percent?: number;
  relevant: boolean;
  higherIsBetter?: boolean;
};

export type TripStats = {
  averageRpm: number;
  maxRpm: number;
  averageSpeedKph: number;
  maxSpeedKph: number;
  averageCoolantTempC: number;
  maxCoolantTempC: number;
  averageMapKpa: number;
  averageMafGps: number;
  averageEngineLoadPercent: number;
  idleSeconds: number;
  distanceKm: number;
  durationSeconds: number;
  averageEngineEffort: number;
};

export type TripComparison = {
  baseStats: TripStats;
  compareStats: TripStats;
  confidence: number;
  metrics: TripMetric[];
  relevantMetrics: TripMetric[];
  summary: string;
  performanceEstimate: string;
  lowConfidence: boolean;
};

export function compareTrips(base: LocalTrip, compare: LocalTrip): TripComparison {
  const baseStats = calculateTripStats(base);
  const compareStats = calculateTripStats(compare);
  const metrics = buildMetrics(baseStats, compareStats);
  const relevantMetrics = metrics.filter((metric) => metric.relevant);
  const confidence = comparisonConfidence(baseStats, compareStats);

  return {
    baseStats,
    compareStats,
    confidence,
    lowConfidence: confidence < 55,
    metrics,
    performanceEstimate: estimatePerformance(metrics),
    relevantMetrics,
    summary: buildSummary(relevantMetrics),
  };
}

export function calculateTripStats(trip: LocalTrip): TripStats {
  const points = trip.points;
  return {
    averageCoolantTempC: average(points, (point) => point.coolantTempC),
    averageEngineEffort: average(points, (point) => point.engineEffort),
    averageEngineLoadPercent: average(points, (point) => point.engineLoadPercent ?? readingValue(point, '0104')),
    averageMafGps: average(points, (point) => readingValue(point, '0110')),
    averageMapKpa: average(points, (point) => point.manifoldPressureKpa ?? readingValue(point, '010B')),
    averageRpm: average(points, (point) => point.rpm),
    averageSpeedKph: average(points, (point) => point.speedKph),
    distanceKm: distanceKm(points),
    durationSeconds: durationSeconds(trip),
    idleSeconds: idleSeconds(points),
    maxCoolantTempC: max(points, (point) => point.coolantTempC),
    maxRpm: max(points, (point) => point.rpm),
    maxSpeedKph: max(points, (point) => point.speedKph),
  };
}

function buildMetrics(base: TripStats, compare: TripStats): TripMetric[] {
  return [
    metric('averageRpm', 'RPM medio', 'rpm', base.averageRpm, compare.averageRpm, 3),
    metric('maxRpm', 'RPM maximo', 'rpm', base.maxRpm, compare.maxRpm, 3),
    metric('averageSpeedKph', 'Velocidade media', 'km/h', base.averageSpeedKph, compare.averageSpeedKph, 5),
    metric('maxSpeedKph', 'Velocidade maxima', 'km/h', base.maxSpeedKph, compare.maxSpeedKph, 5),
    metric('averageCoolantTempC', 'Temperatura media', 'C', base.averageCoolantTempC, compare.averageCoolantTempC, 2, false),
    metric('maxCoolantTempC', 'Temperatura maxima', 'C', base.maxCoolantTempC, compare.maxCoolantTempC, 2, false),
    metric('averageMapKpa', 'MAP medio', 'kPa', base.averageMapKpa, compare.averageMapKpa, 5),
    metric('averageMafGps', 'MAF medio', 'g/s', base.averageMafGps, compare.averageMafGps, 5),
    metric('averageEngineLoadPercent', 'Carga media', '%', base.averageEngineLoadPercent, compare.averageEngineLoadPercent, 5),
    metric('idleSeconds', 'Tempo marcha lenta', 's', base.idleSeconds, compare.idleSeconds, 8, false),
    metric('distanceKm', 'Distancia', 'km', base.distanceKm, compare.distanceKm, 8),
    metric('durationSeconds', 'Tempo total', 's', base.durationSeconds, compare.durationSeconds, 8),
    metric('averageEngineEffort', 'Esforco medio', '%', base.averageEngineEffort, compare.averageEngineEffort, 5),
  ];
}

function metric(id: string, label: string, unit: string, base: number, compare: number, thresholdPercent: number, higherIsBetter = true): TripMetric {
  const delta = compare - base;
  const percent = Math.abs(base) > 0.001 ? (delta / base) * 100 : undefined;
  const relevant = percent === undefined ? Math.abs(delta) > 0 : Math.abs(percent) >= thresholdPercent;
  return { base, compare, delta, higherIsBetter, id, label, percent, relevant, unit };
}

function comparisonConfidence(base: TripStats, compare: TripStats) {
  const scores = [
    similarity(base.distanceKm, compare.distanceKm),
    similarity(base.durationSeconds, compare.durationSeconds),
    similarity(base.averageSpeedKph, compare.averageSpeedKph),
    similarity(base.averageRpm, compare.averageRpm),
  ];

  return Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100);
}

function similarity(a: number, b: number) {
  const maxValue = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.max(0, 1 - Math.abs(a - b) / maxValue);
}

function buildSummary(relevant: TripMetric[]) {
  if (!relevant.length) {
    return 'As gravacoes ficaram muito proximas nas principais metricas. Nao houve diferenca relevante no MVP.';
  }

  const ordered = relevant.slice(0, 4).map((metric) => {
    const direction = metric.delta >= 0 ? 'aumento' : 'reducao';
    const change = metric.percent === undefined ? `${Math.abs(metric.delta).toFixed(1)} ${metric.unit}` : `${Math.abs(metric.percent).toFixed(0)}%`;
    return `${direction} de ${change} em ${metric.label.toLowerCase()}`;
  });

  return `Foi detectado ${joinText(ordered)}. Use a confianca para avaliar se o percurso foi parecido o suficiente.`;
}

function estimatePerformance(metrics: TripMetric[]) {
  const maf = metrics.find((item) => item.id === 'averageMafGps')?.percent ?? 0;
  const map = metrics.find((item) => item.id === 'averageMapKpa')?.percent ?? 0;
  const effort = metrics.find((item) => item.id === 'averageEngineEffort')?.percent ?? 0;
  const speed = metrics.find((item) => item.id === 'averageSpeedKph')?.percent ?? 0;
  const signal = (maf * 0.35) + (map * 0.2) + (effort * 0.2) + (speed * 0.25);
  const low = Math.max(-8, Math.min(12, signal * 0.35));
  const high = Math.max(low, Math.min(16, low + Math.abs(signal * 0.2) + 2));
  const sign = low >= 0 ? '+' : '';
  return `${sign}${low.toFixed(1)}% a ${high >= 0 ? '+' : ''}${high.toFixed(1)}%`;
}

function average(points: LocalTripPoint[], pick: (point: LocalTripPoint) => number | null | undefined) {
  const values = numericValues(points, pick);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function max(points: LocalTripPoint[], pick: (point: LocalTripPoint) => number | null | undefined) {
  const values = numericValues(points, pick);
  return values.length ? Math.max(...values) : 0;
}

function numericValues(points: LocalTripPoint[], pick: (point: LocalTripPoint) => number | null | undefined) {
  return points.map((point) => pick(point)).filter((value): value is number => typeof value === 'number');
}

function idleSeconds(points: LocalTripPoint[]) {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const speed = current.speedKph ?? 0;
    const rpm = current.rpm ?? 0;
    if (speed <= 2 && rpm >= 550 && rpm <= 1200) {
      total += secondsBetween(previous.at, current.at);
    }
  }
  return total;
}

function durationSeconds(trip: LocalTrip) {
  const start = new Date(trip.startedAt).getTime();
  const end = trip.endedAt ? new Date(trip.endedAt).getTime() : new Date(trip.points[trip.points.length - 1]?.at ?? trip.startedAt).getTime();
  return Math.max(0, (end - start) / 1000);
}

function distanceKm(points: LocalTripPoint[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (hasCoordinates(previous) && hasCoordinates(current)) {
      total += haversineKm(previous.latitude, previous.longitude, current.latitude, current.longitude);
    }
  }
  return total;
}

function hasCoordinates(point: LocalTripPoint): point is LocalTripPoint & { latitude: number; longitude: number } {
  return typeof point.latitude === 'number' && typeof point.longitude === 'number';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function secondsBetween(a: string, b: string) {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

function readingValue(point: LocalTripPoint, pid: string) {
  return point.rawReadings.find((reading) => reading.pid === pid)?.value ?? null;
}

function joinText(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] ?? '';
  }

  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}
