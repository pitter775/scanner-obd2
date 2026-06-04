import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors } from '../config/theme';
import { isCloudSyncEnabled } from '../config/env';
import { fetchScanHistory } from '../services/scanRepository';
import type { ScanSessionSummary } from '../types/domain';

export function HistoryScreen() {
  const [sessions, setSessions] = useState<ScanSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);

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
      <Panel title="Historico">
        <AppButton disabled={loading} onPress={loadHistory}>Atualizar historico</AppButton>
      </Panel>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl onRefresh={loadHistory} refreshing={loading} tintColor={colors.primary} />}
      >
        {sessions.length ? sessions.map((session) => <SessionCard key={session.id} session={session} />) : (
          <Text style={styles.text}>Nenhuma sessao carregada.</Text>
        )}
      </ScrollView>
    </Screen>
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
