import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { isSupabaseConfigured } from '../config/env';
import { BluetoothConnection } from '../services/bluetoothService';
import { ObdService } from '../services/obdService';
import { createScanSession, saveReadings, saveVehicleFingerprint } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { ObdReading, VehicleFingerprint } from '../types/domain';

export function DashboardScreen() {
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const appendCommunicationLog = useAppStore((state) => state.appendCommunicationLog);
  const clearCommunicationLog = useAppStore((state) => state.clearCommunicationLog);
  const communicationLog = useAppStore((state) => state.communicationLog);
  const fingerprint = useAppStore((state) => state.fingerprint);
  const readings = useAppStore((state) => state.readings);
  const setFingerprint = useAppStore((state) => state.setFingerprint);
  const setReadings = useAppStore((state) => state.setReadings);
  const [loading, setLoading] = useState(false);

  async function startDiagnostic() {
    if (!activeVehicle || !activeAdapter) {
      Alert.alert('Diagnostico', 'Selecione um veiculo e um adaptador Bluetooth.');
      return;
    }

    setLoading(true);
    clearCommunicationLog();
    const connection = new BluetoothConnection();

    try {
      await connection.connect(activeAdapter.address);
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();
      const nextReadings = await obd.readLiveData();
      setReadings(nextReadings);

      if (isSupabaseConfigured) {
        const session = await createScanSession(activeVehicle.id, activeAdapter.name, activeAdapter.address);
        await saveReadings(session.id, nextReadings);
      }
    } catch (error) {
      Alert.alert('Diagnostico', error instanceof Error ? error.message : 'Falha ao ler dados OBD2.');
    } finally {
      await connection.disconnect();
      setLoading(false);
    }
  }

  async function identifyVehicle() {
    if (!activeVehicle || !activeAdapter) {
      Alert.alert('Identificacao', 'Selecione um veiculo e um adaptador Bluetooth.');
      return;
    }

    setLoading(true);
    clearCommunicationLog();
    const connection = new BluetoothConnection();

    try {
      await connection.connect(activeAdapter.address);
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();
      const nextFingerprint = await obd.identifyVehicle();
      setFingerprint(nextFingerprint);

      if (isSupabaseConfigured) {
        const session = await createScanSession(activeVehicle.id, activeAdapter.name, activeAdapter.address);
        await saveVehicleFingerprint(activeVehicle.id, session.id, nextFingerprint);
      }
    } catch (error) {
      Alert.alert('Identificacao', error instanceof Error ? error.message : 'Falha ao identificar veiculo.');
    } finally {
      await connection.disconnect();
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Panel title="Leitura em tempo real">
        <AppButton disabled={loading} onPress={startDiagnostic}>Ler sensores agora</AppButton>
        <AppButton disabled={loading} onPress={identifyVehicle} tone="secondary">Identificar veiculo</AppButton>
      </Panel>

      {fingerprint ? <FingerprintPanel fingerprint={fingerprint} /> : null}

      <View style={styles.grid}>
        {readings.length ? readings.map((reading) => <ReadingCard key={reading.pid} reading={reading} />) : (
          <Text style={styles.muted}>Nenhuma leitura realizada nesta sessao.</Text>
        )}
      </View>

      {communicationLog.length ? (
        <Panel title="Log OBD2">
          {communicationLog.slice(-12).map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
          ))}
        </Panel>
      ) : null}
    </Screen>
  );
}

function FingerprintPanel({ fingerprint }: { fingerprint: VehicleFingerprint }) {
  return (
    <Panel title="Filtro do veiculo">
      <Text style={styles.fingerprintMain}>
        {fingerprint.likelyMake ?? 'Marca nao identificada'}
        {fingerprint.likelyYear ? ` - ${fingerprint.likelyYear}` : ''}
      </Text>
      <Text style={styles.muted}>Confianca: {confidenceLabel[fingerprint.confidence]}</Text>
      {fingerprint.vin ? <Text style={styles.muted}>VIN: {fingerprint.vin}</Text> : null}
      {fingerprint.protocol ? <Text style={styles.muted}>Protocolo: {fingerprint.protocol}</Text> : null}
      {fingerprint.calibrationIds.length ? <Text style={styles.muted}>Calibracao: {fingerprint.calibrationIds.join(', ')}</Text> : null}
      {fingerprint.ecuNames.length ? <Text style={styles.muted}>ECU: {fingerprint.ecuNames.join(', ')}</Text> : null}
    </Panel>
  );
}

function ReadingCard({ reading }: { reading: ObdReading }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{reading.name}</Text>
      <Text style={styles.cardValue}>{reading.value}</Text>
      <Text style={styles.cardUnit}>{reading.unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    minHeight: 118,
    padding: spacing.md,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cardUnit: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  cardValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginVertical: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  muted: {
    color: colors.muted,
  },
  fingerprintMain: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  logLine: {
    color: colors.muted,
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

const confidenceLabel: Record<VehicleFingerprint['confidence'], string> = {
  high: 'alta',
  low: 'baixa',
  medium: 'media',
  none: 'nenhuma',
};
