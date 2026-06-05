import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors } from '../config/theme';
import { isCloudSyncEnabled } from '../config/env';
import { serializeTripExport, serializeTripSummaryExport } from '../services/localTripRepository';
import { fetchScanHistory } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { LocalTrip, LocalTripSummary, ScanSessionSummary } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const [sessions, setSessions] = useState<ScanSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const localTripSummaries = useAppStore((state) => state.localTripSummaries);
  const localTrips = useAppStore((state) => state.localTrips);
  const loadLocalTrips = useAppStore((state) => state.loadLocalTrips);

  useEffect(() => {
    void loadLocalTrips();
  }, [loadLocalTrips]);

  const loadHistory = useCallback(async () => {
    if (!isCloudSyncEnabled) {
      Alert.alert('Historico', 'Historico em nuvem desativado neste APK de teste.');
      return;
    }

    setLoading(true);
    try {
      setSessions(await fetchScanHistory());
    } catch (error) {
      Alert.alert('Historico', error instanceof Error ? error.message : 'Falha ao carregar historico.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl onRefresh={() => void loadLocalTrips()} refreshing={loading} tintColor={colors.primary} />}
      >
        <Panel title="Voltas locais">
          <AppButton disabled={loading} icon="refresh" onPress={() => void loadLocalTrips()} tone="secondary">Atualizar voltas</AppButton>
          <AppButton disabled={localTrips.length < 2} icon="chart" onPress={() => navigation.navigate('TripCompare')} tone="secondary">Comparar gravacoes</AppButton>
        </Panel>

        {localTripSummaries.length ? localTripSummaries.map((summary) => {
          const trip = localTrips.find((item) => item.id === summary.id);
          return (
          <LocalTripCard
            key={summary.id}
            onExport={() => void exportTrip(summary, trip)}
            onOpenMap={() => trip && navigation.navigate('TripMap', { tripId: trip.id })}
            summary={summary}
            trip={trip}
          />
          );
        }) : (
          <Text style={styles.text}>Nenhuma volta local salva.</Text>
        )}
        <Panel title="Historico em nuvem">
          <AppButton disabled={loading} icon="refresh" onPress={loadHistory}>Atualizar historico</AppButton>
        </Panel>

        {sessions.length ? sessions.map((session) => <SessionCard key={session.id} session={session} />) : (
          <Text style={styles.text}>Nenhuma sessao carregada.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

async function exportTrip(summary: LocalTripSummary, trip?: LocalTrip) {
  await Share.share({
    message: trip ? serializeTripExport(trip) : serializeTripSummaryExport(summary),
    title: `Volta ${formatDate(summary.startedAt)}`,
  });
}

function LocalTripCard({ onExport, onOpenMap, summary, trip }: { onExport: () => void; onOpenMap: () => void; summary: LocalTripSummary; trip?: LocalTrip }) {
  const vehicle = summary.vehicle;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {summary.name || (vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.year}` : 'Veiculo nao identificado')}
      </Text>
      {vehicle ? <Text style={styles.text}>{vehicle.make} {vehicle.model} {vehicle.year}</Text> : null}
      {summary.notes ? <Text style={styles.text}>{summary.notes}</Text> : null}
      <Text style={styles.text}>Inicio: {formatDate(summary.startedAt)}</Text>
      <Text style={styles.text}>Pontos: {summary.pointCount} | GPS: {summary.gpsPointCount}</Text>
      <Text style={styles.text}>
        Max: {Math.round(summary.maxSpeedKph ?? 0)} km/h | {Math.round(summary.maxRpm ?? 0)} rpm | esforco {Math.round(summary.maxEngineEffort ?? 0)}%
      </Text>
      {summary.adapterName ? <Text style={styles.text}>Adaptador: {summary.adapterName}</Text> : null}
      {!summary.fullTripAvailable || !trip ? <Text style={styles.archiveText}>Resumo arquivado. Mapa completo/exportacao bruta ficam nas voltas recentes.</Text> : null}
      <View style={styles.actions}>
        <AppButton compact disabled={!trip} icon="radar" onPress={onOpenMap} tone="secondary">Mapa</AppButton>
        <AppButton compact icon="send" onPress={onExport} tone="secondary">Exportar</AppButton>
      </View>
    </View>
  );
}

function SessionCard({ session }: { session: ScanSessionSummary }) {
  const vehicle = session.vehicles;
  const readingsCount = session.live_readings?.length ?? 0;
  const dtcCount = session.dtc_codes?.length ?? 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.year}` : 'Veiculo removido'}
      </Text>
      <Text style={styles.text}>Inicio: {formatDate(session.started_at)}</Text>
      <Text style={styles.text}>Status: {statusLabel[session.status]}</Text>
      <Text style={styles.text}>Leituras: {readingsCount} | DTCs: {dtcCount}</Text>
      {session.adapter_name ? <Text style={styles.text}>Adaptador: {session.adapter_name}</Text> : null}
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const statusLabel: Record<ScanSessionSummary['status'], string> = {
  failed: 'falhou',
  finished: 'finalizada',
  open: 'aberta',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  archiveText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  list: {
    gap: 16,
  },
  text: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
});
