import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { isCloudSyncEnabled, isSupabaseConfigured } from '../config/env';
import { shareDiagnosticReport } from '../services/diagnosticLog';
import { useAppStore } from '../store/appStore';

export function DebugScreen() {
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const clearDiagnosticEvents = useAppStore((state) => state.clearDiagnosticEvents);
  const communicationLog = useAppStore((state) => state.communicationLog);
  const connectionReady = useAppStore((state) => state.connectionReady);
  const diagnosticEvents = useAppStore((state) => state.diagnosticEvents);
  const dtcs = useAppStore((state) => state.dtcs);
  const fingerprint = useAppStore((state) => state.fingerprint);
  const readings = useAppStore((state) => state.readings);

  return (
    <Screen>
      <Panel title="Ambiente">
        <Info label="Supabase" value={isSupabaseConfigured ? 'configurado' : 'nao configurado'} />
        <Info label="Nuvem" value={isCloudSyncEnabled ? 'ativa' : 'desativada para teste'} />
        <Info label="Build" value="release/local" />
      </Panel>

      <Panel title="Estado atual">
        <Info label="Veiculo" value={activeVehicle ? `${activeVehicle.make} ${activeVehicle.model} ${activeVehicle.year}` : 'nenhum'} />
        <Info label="Adaptador" value={activeAdapter ? `${activeAdapter.name} (${activeAdapter.address})` : 'nenhum'} />
        <Info label="Conexao OBD2" value={connectionReady ? 'validada' : 'nao validada'} />
        <Info label="Leituras" value={String(readings.length)} />
        <Info label="DTCs" value={String(dtcs.length)} />
        <Info label="Linhas de log" value={String(communicationLog.length)} />
        <Info label="Erros/avisos" value={String(diagnosticEvents.length)} />
      </Panel>

      <Panel subtitle="Use depois dos testes para enviar tudo que aconteceu no app." title="Relatorio de teste">
        <AppButton onPress={shareDiagnosticReport}>Compartilhar relatorio</AppButton>
        <AppButton onPress={clearDiagnosticEvents} tone="secondary">Limpar erros/avisos</AppButton>
      </Panel>

      {fingerprint ? (
        <Panel title="Fingerprint">
          <Info label="VIN" value={fingerprint.vin ?? 'nao retornou'} />
          <Info label="Protocolo" value={fingerprint.protocol ?? 'nao retornou'} />
          <Info label="Confianca" value={fingerprint.confidence} />
          <Info label="Marca provavel" value={fingerprint.likelyMake ?? 'nao identificada'} />
        </Panel>
      ) : null}

      <Panel title="Ultimas leituras">
        {readings.length ? readings.map((reading) => (
          <Info
            key={reading.pid}
            label={reading.pid}
            value={`${reading.name}: ${reading.value} ${reading.unit}`}
          />
        )) : <Text style={styles.muted}>Nenhuma leitura carregada.</Text>}
      </Panel>

      <Panel title="DTCs carregados">
        {dtcs.length ? dtcs.map((dtc) => (
          <Info key={`${dtc.status}-${dtc.code}`} label={dtc.code} value={`${dtc.status}: ${dtc.description}`} />
        )) : <Text style={styles.muted}>Nenhum DTC carregado.</Text>}
      </Panel>

      <Panel title="Log OBD2">
        {communicationLog.length ? communicationLog.slice(-40).map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
        )) : <Text style={styles.muted}>Nenhum log carregado.</Text>}
      </Panel>

      <Panel title="Erros e avisos">
        {diagnosticEvents.length ? diagnosticEvents.slice(-40).map((event) => (
          <View key={event.id} style={styles.event}>
            <Text selectable style={styles.logLine}>[{event.at}] {event.level.toUpperCase()}: {event.message}</Text>
            {event.details ? <Text selectable style={styles.logLine}>{event.details}</Text> : null}
          </View>
        )) : <Text style={styles.muted}>Nenhum erro ou aviso capturado.</Text>}
      </Panel>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  info: {
    gap: 3,
  },
  event: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  logLine: {
    color: colors.muted,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
});
