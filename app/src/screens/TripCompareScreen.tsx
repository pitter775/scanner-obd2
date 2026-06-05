import { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { compareTrips, type TripMetric } from '../lib/tripComparison';
import { useAppStore } from '../store/appStore';
import type { LocalTrip } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCompare'>;

export function TripCompareScreen({ route }: Props) {
  const localTrips = useAppStore((state) => state.localTrips);
  const [baseId, setBaseId] = useState(route.params?.baseTripId ?? '');
  const [compareId, setCompareId] = useState(route.params?.compareTripId ?? '');
  const baseTrip = localTrips.find((trip) => trip.id === baseId);
  const compareTrip = localTrips.find((trip) => trip.id === compareId);
  const comparison = useMemo(() => (
    baseTrip && compareTrip && baseTrip.id !== compareTrip.id ? compareTrips(baseTrip, compareTrip) : null
  ), [baseTrip, compareTrip]);

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={styles.list}>
        <Panel title="Comparar gravacoes">
          <Text style={styles.text}>Escolha manualmente a gravacao base e a comparativa.</Text>
          <TripPicker label="Base / Antes" selectedId={baseId} trips={localTrips} onSelect={setBaseId} />
          <TripPicker label="Comparativa / Depois" selectedId={compareId} trips={localTrips} onSelect={setCompareId} />
        </Panel>

        {comparison ? (
          <>
            <Panel title="Confianca da comparacao">
              <Text style={[styles.confidence, comparison.lowConfidence ? styles.confidenceLow : styles.confidenceHigh]}>
                {comparison.confidence}%
              </Text>
              {comparison.lowConfidence ? (
                <Text style={styles.warning}>
                  Os percursos possuem caracteristicas muito diferentes. Os resultados podem nao representar exclusivamente alteracoes mecanicas do veiculo.
                </Text>
              ) : null}
            </Panel>

            <Panel title="Metricas">
              {comparison.metrics.map((metric) => <MetricRow key={metric.id} metric={metric} />)}
            </Panel>

            <Panel title="Principais Diferencas">
              {comparison.relevantMetrics.length ? comparison.relevantMetrics.map((metric) => (
                <MetricRow compact key={metric.id} metric={metric} />
              )) : <Text style={styles.text}>Nenhuma diferenca relevante detectada.</Text>}
            </Panel>

            <Panel title="Resumo Inteligente">
              <Text style={styles.summary}>{comparison.summary}</Text>
            </Panel>

            <Panel title="Estimativa de Desempenho">
              <Text style={styles.estimate}>Potencial ganho estimado: {comparison.performanceEstimate}</Text>
              <Text style={styles.warning}>Esta estimativa utiliza dados coletados pelo veiculo e nao substitui testes realizados em dinamometro.</Text>
            </Panel>
          </>
        ) : (
          <Text style={styles.text}>Selecione duas gravacoes completas recentes para comparar.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function TripPicker({ label, onSelect, selectedId, trips }: { label: string; onSelect: (id: string) => void; selectedId: string; trips: LocalTrip[] }) {
  return (
    <View style={styles.picker}>
      <Text style={styles.pickerTitle}>{label}</Text>
      <View style={styles.tripGrid}>
        {trips.map((trip) => (
          <Pressable key={trip.id} onPress={() => onSelect(trip.id)} style={[styles.tripOption, selectedId === trip.id && styles.tripOptionActive]}>
            <Text style={[styles.tripName, selectedId === trip.id && styles.tripNameActive]}>{trip.name || 'Gravacao sem nome'}</Text>
            <Text style={styles.tripMeta}>{formatDate(trip.startedAt)}</Text>
            {trip.notes ? <Text numberOfLines={1} style={styles.tripMeta}>{trip.notes}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MetricRow({ compact, metric }: { compact?: boolean; metric: TripMetric }) {
  const positive = metric.delta >= 0;
  const color = positive ? colors.success : colors.danger;
  const deltaText = metric.percent === undefined
    ? `${positive ? '+' : ''}${metric.delta.toFixed(1)} ${metric.unit}`
    : `${positive ? '+' : ''}${metric.percent.toFixed(0)}%`;

  return (
    <View style={[styles.metricRow, compact && styles.metricRowCompact]}>
      <View style={styles.metricNameWrap}>
        <Text style={styles.metricName}>{metric.label}</Text>
        <Text style={styles.metricBase}>
          {formatNumber(metric.base)} {'->'} {formatNumber(metric.compare)} {metric.unit}
        </Text>
      </View>
      <Text style={[styles.metricDelta, { color }]}>{deltaText}</Text>
    </View>
  );
}

function formatNumber(value: number) {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  return value.toFixed(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  confidence: {
    fontSize: 42,
    fontWeight: '900',
  },
  confidenceHigh: {
    color: colors.success,
  },
  confidenceLow: {
    color: colors.warning,
  },
  estimate: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  list: {
    gap: spacing.md,
  },
  metricBase: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  metricDelta: {
    fontSize: 20,
    fontWeight: '900',
  },
  metricName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  metricNameWrap: {
    flex: 1,
  },
  metricRow: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  metricRowCompact: {
    borderColor: colors.borderStrong,
  },
  picker: {
    gap: spacing.sm,
  },
  pickerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  summary: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  tripGrid: {
    gap: spacing.sm,
  },
  tripMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  tripName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  tripNameActive: {
    color: colors.white,
  },
  tripOption: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: spacing.sm,
  },
  tripOptionActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryGlow,
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
});
