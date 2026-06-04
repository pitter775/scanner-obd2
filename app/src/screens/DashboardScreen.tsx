import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { ConnectionGauge } from '../components/ConnectionGauge';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { isCloudSyncEnabled } from '../config/env';
import { getSharedConnection, obdBluetoothErrorMessage, type BluetoothConnection } from '../services/bluetoothService';
import { recordDiagnosticEvent } from '../services/diagnosticLog';
import { ObdService } from '../services/obdService';
import { createScanSession, finishScanSession, saveReadings, saveVehicleFingerprint } from '../services/scanRepository';
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
  const setActiveVehicle = useAppStore((state) => state.setActiveVehicle);
  const setReadings = useAppStore((state) => state.setReadings);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Conectando ao adaptador OBD2...');
  const [statusMessage, setStatusMessage] = useState('');
  const [liveRunning, setLiveRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(2000);
  const liveConnectionRef = useRef<BluetoothConnection | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const liveRunningRef = useRef(false);
  const liveFinalStatusRef = useRef<'finished' | 'failed'>('finished');

  useEffect(() => () => {
    liveRunningRef.current = false;
  }, []);

  async function startDiagnostic() {
    const vehicle = activeVehicle ?? defaultVehicle;
    if (!activeVehicle) {
      setActiveVehicle(vehicle);
    }

    if (!activeAdapter) {
      setStatusMessage('Conecte o SP359 na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Conectando ao adaptador OBD2...');
    setStatusMessage('');
    clearCommunicationLog();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      setLoadingLabel('Inicializando adaptador...');
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();
      setLoadingLabel('Lendo sensores...');
      const nextReadings = await obd.readLiveData();
      setReadings(nextReadings);

      if (isCloudSyncEnabled) {
        const session = await createScanSession(vehicle.id, activeAdapter.name, activeAdapter.address);
        await saveReadings(session.id, nextReadings);
        await finishScanSession(session.id);
      }
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha ao ler sensores OBD2', error);
      setStatusMessage(obdBluetoothErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function identifyVehicle() {
    const vehicle = activeVehicle ?? defaultVehicle;
    if (!activeVehicle) {
      setActiveVehicle(vehicle);
    }

    if (!activeAdapter) {
      setStatusMessage('Conecte o SP359 na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Conectando ao adaptador OBD2...');
    setStatusMessage('');
    clearCommunicationLog();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      setLoadingLabel('Coletando identificacao...');
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();
      const nextFingerprint = await obd.identifyVehicle();
      setFingerprint(nextFingerprint);

      if (isCloudSyncEnabled) {
        const session = await createScanSession(vehicle.id, activeAdapter.name, activeAdapter.address);
        await saveVehicleFingerprint(vehicle.id, session.id, nextFingerprint);
        await finishScanSession(session.id);
      }
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha ao identificar veiculo via OBD2', error);
      setStatusMessage(obdBluetoothErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function startLiveDiagnostic() {
    const vehicle = activeVehicle ?? defaultVehicle;
    if (!activeVehicle) {
      setActiveVehicle(vehicle);
    }

    if (!activeAdapter) {
      setStatusMessage('Conecte o SP359 na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Conectando ao adaptador OBD2...');
    setStatusMessage('');
    clearCommunicationLog();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      liveConnectionRef.current = connection;
      setLoadingLabel('Inicializando leitura continua...');
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();

      if (isCloudSyncEnabled) {
        const session = await createScanSession(vehicle.id, activeAdapter.name, activeAdapter.address);
        liveSessionIdRef.current = session.id;
      }

      liveRunningRef.current = true;
      liveFinalStatusRef.current = 'finished';
      setLiveRunning(true);

      while (liveRunningRef.current) {
        setLoadingLabel('Atualizando sensores...');
        const nextReadings = await obd.readLiveData();
        setReadings(nextReadings);

        if (isCloudSyncEnabled && liveSessionIdRef.current) {
          await saveReadings(liveSessionIdRef.current, nextReadings);
        }

        await delay(intervalMs);
      }
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha na leitura continua OBD2', error);
      liveFinalStatusRef.current = 'failed';
      setStatusMessage(obdBluetoothErrorMessage(error));
    } finally {
      if (isCloudSyncEnabled && liveSessionIdRef.current) {
        await finishScanSession(liveSessionIdRef.current, liveFinalStatusRef.current);
      }
      liveSessionIdRef.current = null;
      liveRunningRef.current = false;
      setLiveRunning(false);
      liveConnectionRef.current = null;
      setLoading(false);
    }
  }

  function stopLiveDiagnostic() {
    liveRunningRef.current = false;
    setLiveRunning(false);
  }

  return (
    <Screen>
      <Panel title="Leitura em tempo real">
        <ConnectionGauge active={loading} label={loadingLabel} />
        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        <AppButton disabled={loading} onPress={startDiagnostic}>Ler sensores agora</AppButton>
        <View style={styles.intervalRow}>
          <Text style={styles.muted}>Intervalo: {intervalMs / 1000}s</Text>
          <View style={styles.intervalActions}>
            <AppButton disabled={loading || intervalMs <= 1000} onPress={() => setIntervalMs((value) => Math.max(1000, value - 1000))} tone="secondary">-</AppButton>
            <AppButton disabled={loading || intervalMs >= 5000} onPress={() => setIntervalMs((value) => Math.min(5000, value + 1000))} tone="secondary">+</AppButton>
          </View>
        </View>
        <AppButton disabled={loading && !liveRunning} onPress={liveRunning ? stopLiveDiagnostic : startLiveDiagnostic} tone={liveRunning ? 'danger' : 'secondary'}>
          {liveRunning ? 'Parar leitura continua' : 'Iniciar leitura continua'}
        </AppButton>
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
  intervalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  intervalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  muted: {
    color: colors.muted,
  },
  statusMessage: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
    padding: spacing.md,
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

const defaultVehicle = {
  id: 'local-focus-2006',
  make: 'Ford',
  model: 'Focus',
  user_id: 'local',
  year: 2006,
};

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
