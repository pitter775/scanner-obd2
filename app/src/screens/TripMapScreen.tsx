import { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { useAppStore } from '../store/appStore';
import type { LocalTrip, LocalTripPoint } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TripMap'>;
type MetricId = 'speed' | 'rpm' | 'temperature' | 'load' | 'map' | 'throttle' | 'effort';
type CoordinatePoint = LocalTripPoint & { latitude: number; longitude: number };

const metricOptions: Array<{
  id: MetricId;
  label: string;
  unit: string;
  max: number;
  value: (point: LocalTripPoint) => number | null | undefined;
}> = [
  { id: 'speed', label: 'Velocidade', max: 160, unit: 'km/h', value: (point) => point.speedKph },
  { id: 'rpm', label: 'RPM', max: 6000, unit: 'rpm', value: (point) => point.rpm },
  { id: 'temperature', label: 'Temp.', max: 120, unit: 'C', value: (point) => point.coolantTempC },
  { id: 'load', label: 'Carga', max: 100, unit: '%', value: (point) => point.engineLoadPercent ?? readingValue(point, '0104') },
  { id: 'map', label: 'MAP', max: 110, unit: 'kPa', value: (point) => point.manifoldPressureKpa ?? readingValue(point, '010B') },
  { id: 'throttle', label: 'Borboleta', max: 100, unit: '%', value: (point) => point.throttlePercent },
  { id: 'effort', label: 'Esforco', max: 100, unit: '%', value: (point) => point.engineEffort ?? fallbackEffort(point) },
];

export function TripMapScreen({ route }: Props) {
  const [metricId, setMetricId] = useState<MetricId>('speed');
  const trip = useAppStore((state) => state.localTrips.find((item) => item.id === route.params.tripId));

  if (!trip) {
    return (
      <Screen>
        <Text style={styles.text}>Volta nao encontrada.</Text>
      </Screen>
    );
  }

  const metric = metricOptions.find((item) => item.id === metricId) ?? metricOptions[0];
  const gpsPoints = trip.points.filter(hasCoordinates);
  const summary = summarizeTrip(trip);
  const highlights = buildHighlights(trip);

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={styles.list}>
        <Panel title="Mapa da volta">
          <Text style={styles.title}>{trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model} ${trip.vehicle.year}` : 'Veiculo nao identificado'}</Text>
          <Text style={styles.text}>Inicio: {formatDate(trip.startedAt)}</Text>
          <Text style={styles.text}>Pontos OBD2: {trip.points.length} | Pontos GPS: {gpsPoints.length}</Text>
          <MetricTabs active={metricId} onChange={setMetricId} />
          <TripMap metric={metric} points={gpsPoints} />
          <MapLegend metric={metric} />
        </Panel>

        <Panel title="Resumo da volta">
          <View style={styles.summaryGrid}>
            <Info label="Vel. maxima" value={`${Math.round(summary.maxSpeed)} km/h`} />
            <Info label="RPM maximo" value={`${Math.round(summary.maxRpm)} rpm`} />
            <Info label="Temp. maxima" value={`${Math.round(summary.maxTemp)} C`} />
            <Info label="Maior esforco" value={`${Math.round(summary.maxEffort)}%`} />
            <Info label="Carga maxima" value={`${Math.round(summary.maxLoad)}%`} />
            <Info label="MAP maximo" value={`${Math.round(summary.maxMap)} kPa`} />
          </View>
        </Panel>

        <Panel title="Pontos criticos">
          {highlights.length ? highlights.map((item) => (
            <View key={`${item.point.id}-${item.label}`} style={styles.highlightRow}>
              <View style={[styles.highlightDot, { backgroundColor: item.color }]} />
              <View style={styles.highlightText}>
                <Text style={styles.highlightTitle}>{item.label}</Text>
                <Text style={styles.text}>{timeLabel(item.point.at)} | {item.detail}</Text>
              </View>
            </View>
          )) : <Text style={styles.text}>Nenhum ponto critico detectado nesta volta.</Text>}
        </Panel>

        <Panel title="Linha do tempo">
          {trip.points.slice(-30).map((point) => (
            <Text key={point.id} style={styles.text}>
              {timeLabel(point.at)} | {Math.round(point.speedKph ?? 0)} km/h | {Math.round(point.rpm ?? 0)} rpm | esforco {Math.round(metricValue(metricOptions[6], point))}%
            </Text>
          ))}
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function MetricTabs({ active, onChange }: { active: MetricId; onChange: (metric: MetricId) => void }) {
  return (
    <View style={styles.tabs}>
      {metricOptions.map((metric) => (
        <Pressable key={metric.id} onPress={() => onChange(metric.id)} style={[styles.tab, active === metric.id && styles.tabActive]}>
          <Text style={[styles.tabText, active === metric.id && styles.tabTextActive]}>{metric.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TripMap({ metric, points }: { metric: (typeof metricOptions)[number]; points: CoordinatePoint[] }) {
  const path = useMemo(() => buildPath(points, metric), [metric, points]);

  if (points.length < 2 || !path) {
    return (
      <View style={styles.emptyMap}>
        <Text style={styles.text}>Sem pontos GPS suficientes para desenhar o mapa.</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapBox}>
      <Svg height={path.height} viewBox={`0 0 ${path.width} ${path.height}`} width="100%">
        {path.grid.map((line) => (
          <Line key={line.key} stroke={colors.border} strokeOpacity={0.35} strokeWidth="1" x1={line.x1} x2={line.x2} y1={line.y1} y2={line.y2} />
        ))}
        {path.segments.map((segment) => (
          <Polyline
            key={segment.key}
            fill="none"
            points={segment.points}
            stroke={segment.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6"
          />
        ))}
        {path.alerts.map((alert) => (
          <Circle key={alert.key} cx={alert.x} cy={alert.y} fill={alert.color} r="5" stroke={colors.background} strokeWidth="2" />
        ))}
        <Circle cx={path.start.x} cy={path.start.y} fill={colors.success} r="7" />
        <Circle cx={path.end.x} cy={path.end.y} fill={colors.danger} r="7" />
      </Svg>
    </View>
  );
}

function MapLegend({ metric }: { metric: (typeof metricOptions)[number] }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendSwatch, { backgroundColor: colors.electric }]} />
      <Text style={styles.legendText}>baixo</Text>
      <View style={[styles.legendSwatch, { backgroundColor: colors.success }]} />
      <Text style={styles.legendText}>normal</Text>
      <View style={[styles.legendSwatch, { backgroundColor: colors.warning }]} />
      <Text style={styles.legendText}>alto</Text>
      <View style={[styles.legendSwatch, { backgroundColor: colors.danger }]} />
      <Text style={styles.legendText}>pico de {metric.label.toLowerCase()}</Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function buildPath(points: CoordinatePoint[], metric: (typeof metricOptions)[number]) {
  if (points.length < 2) {
    return null;
  }

  const width = 340;
  const height = 240;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.00001);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.00001);
  const projected = points.map((point) => ({
    point,
    x: 16 + ((point.longitude - minLongitude) / longitudeSpan) * (width - 32),
    y: 16 + ((maxLatitude - point.latitude) / latitudeSpan) * (height - 32),
  }));

  return {
    alerts: projected
      .filter(({ point }) => isCritical(point))
      .slice(0, 24)
      .map(({ point, x, y }) => ({
        color: criticalColor(point),
        key: `alert-${point.id}`,
        x,
        y,
      })),
    end: projected[projected.length - 1],
    grid: Array.from({ length: 4 }).flatMap((_, index) => [
      { key: `h-${index}`, x1: 0, x2: width, y1: 48 + index * 48, y2: 48 + index * 48 },
      { key: `v-${index}`, x1: 68 + index * 68, x2: 68 + index * 68, y1: 0, y2: height },
    ]),
    height,
    segments: projected.slice(1).map((item, index) => {
      const previous = projected[index];
      const intensity = metricValue(metric, item.point) / metric.max;
      return {
        color: intensityColor(intensity),
        key: `${previous.point.id}-${item.point.id}`,
        points: `${previous.x.toFixed(1)},${previous.y.toFixed(1)} ${item.x.toFixed(1)},${item.y.toFixed(1)}`,
      };
    }),
    start: projected[0],
    width,
  };
}

function summarizeTrip(trip: LocalTrip) {
  return {
    maxEffort: maxMetric(trip.points, metricOptions[6]),
    maxLoad: maxMetric(trip.points, metricOptions[3]),
    maxMap: maxMetric(trip.points, metricOptions[4]),
    maxRpm: maxMetric(trip.points, metricOptions[1]),
    maxSpeed: maxMetric(trip.points, metricOptions[0]),
    maxTemp: maxMetric(trip.points, metricOptions[2]),
  };
}

function buildHighlights(trip: LocalTrip) {
  const points = trip.points;
  const highest = [
    highlightFor('Maior velocidade', metricOptions[0], points, colors.electric),
    highlightFor('Maior RPM', metricOptions[1], points, colors.warning),
    highlightFor('Maior temperatura', metricOptions[2], points, colors.danger),
    highlightFor('Maior esforco do motor', metricOptions[6], points, colors.violet),
  ].filter(Boolean) as Array<{ color: string; detail: string; label: string; point: LocalTripPoint }>;

  return highest;
}

function highlightFor(label: string, metric: (typeof metricOptions)[number], points: LocalTripPoint[], color: string) {
  const point = points.reduce<LocalTripPoint | undefined>((best, current) => (
    metricValue(metric, current) > metricValue(metric, best) ? current : best
  ), undefined);

  if (!point || metricValue(metric, point) <= 0) {
    return null;
  }

  return {
    color,
    detail: `${Math.round(metricValue(metric, point))} ${metric.unit}`,
    label,
    point,
  };
}

function maxMetric(points: LocalTripPoint[], metric: (typeof metricOptions)[number]) {
  return Math.max(0, ...points.map((point) => metricValue(metric, point)));
}

function metricValue(metric: (typeof metricOptions)[number], point?: LocalTripPoint) {
  if (!point) {
    return 0;
  }

  return metric.value(point) ?? 0;
}

function fallbackEffort(point: LocalTripPoint) {
  const load = point.engineLoadPercent ?? readingValue(point, '0104');
  const map = point.manifoldPressureKpa ?? readingValue(point, '010B');
  const values = [
    normalize(load, 100),
    normalize(map, 100),
    normalize(point.rpm, 6000),
    normalize(point.throttlePercent, 100),
  ].filter((value) => value != null) as number[];

  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) * 100 : null;
}

function readingValue(point: LocalTripPoint, pid: string) {
  return point.rawReadings.find((reading) => reading.pid === pid)?.value ?? null;
}

function normalize(value: number | null | undefined, max: number) {
  return typeof value === 'number' ? Math.max(0, Math.min(1, value / max)) : null;
}

function intensityColor(value: number) {
  if (value >= 0.82) return colors.danger;
  if (value >= 0.62) return colors.warning;
  if (value >= 0.32) return colors.success;
  return colors.electric;
}

function isCritical(point: LocalTripPoint) {
  return (point.coolantTempC ?? 0) >= 100
    || (point.rpm ?? 0) >= 4500
    || metricValue(metricOptions[6], point) >= 75;
}

function criticalColor(point: LocalTripPoint) {
  if ((point.coolantTempC ?? 0) >= 100) return colors.danger;
  if ((point.rpm ?? 0) >= 4500) return colors.warning;
  return colors.violet;
}

function hasCoordinates(point: LocalTripPoint): point is CoordinatePoint {
  return typeof point.latitude === 'number' && typeof point.longitude === 'number';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  emptyMap: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 180,
    justifyContent: 'center',
    padding: spacing.md,
  },
  highlightDot: {
    borderRadius: 999,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  highlightText: {
    flex: 1,
  },
  highlightTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  info: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 4,
    padding: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: spacing.sm,
  },
  legendSwatch: {
    borderRadius: 3,
    height: 10,
    width: 20,
  },
  legendText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    gap: spacing.md,
  },
  mapBox: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tab: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryGlow,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  tabTextActive: {
    color: colors.white,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
