import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

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
import type { ObdReading, Vehicle, VehicleFingerprint } from '../types/domain';

export function DashboardScreen() {
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const appendCommunicationLog = useAppStore((state) => state.appendCommunicationLog);
  const appendObdRawResponse = useAppStore((state) => state.appendObdRawResponse);
  const clearCommunicationLog = useAppStore((state) => state.clearCommunicationLog);
  const clearObdRawResponses = useAppStore((state) => state.clearObdRawResponses);
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
  const [showOptions, setShowOptions] = useState(false);
  const liveConnectionRef = useRef<BluetoothConnection | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const liveRunningRef = useRef(false);
  const liveFinalStatusRef = useRef<'finished' | 'failed'>('finished');

  useEffect(() => () => {
    liveRunningRef.current = false;
  }, []);

  async function startDiagnostic() {
    const vehicle = ensureVehicle(activeVehicle, setActiveVehicle);

    if (!activeAdapter) {
      setStatusMessage('Conecte o adaptador OBDII na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Lendo sensores...');
    setStatusMessage('');
    clearCommunicationLog();
    clearObdRawResponses();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();
      const nextReadings = await obd.readLiveData((reading) => setReadings(upsertReading(useAppStore.getState().readings, reading)));
      setReadings(nextReadings);
      (await obd.readRawSnapshot()).forEach(appendObdRawResponse);

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
    const vehicle = ensureVehicle(activeVehicle, setActiveVehicle);

    if (!activeAdapter) {
      setStatusMessage('Conecte o adaptador OBDII na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Coletando identificacao...');
    setStatusMessage('');
    clearCommunicationLog();
    clearObdRawResponses();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      const obd = new ObdService(connection, appendCommunicationLog);
      await obd.initialize();
      const nextFingerprint = await obd.identifyVehicle();
      setFingerprint(nextFingerprint);
      (await obd.readRawSnapshot()).forEach(appendObdRawResponse);

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
    const vehicle = ensureVehicle(activeVehicle, setActiveVehicle);

    if (!activeAdapter) {
      setStatusMessage('Conecte o adaptador OBDII na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Conectando ao adaptador OBD2...');
    setStatusMessage('');
    clearCommunicationLog();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      liveConnectionRef.current = connection;
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
        const nextReadings = await obd.readLiveData((reading) => setReadings(upsertReading(useAppStore.getState().readings, reading)));
        setReadings(nextReadings);

        if (isCloudSyncEnabled && liveSessionIdRef.current) {
          await saveReadings(liveSessionIdRef.current, nextReadings);
        }
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
      <VehicleHero vehicle={activeVehicle ?? defaultVehicle} />
      <Panel title="Leitura em tempo real">
        <ConnectionGauge active={loading} label={loadingLabel} moduleName={activeAdapter?.name ?? 'OBDII'} />
        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        <AppButton disabled={loading} icon="●" onPress={startDiagnostic}>Ler sensores agora</AppButton>
        <AppButton disabled={loading && !liveRunning} icon={liveRunning ? '■' : '▶'} onPress={liveRunning ? stopLiveDiagnostic : startLiveDiagnostic} tone={liveRunning ? 'danger' : 'secondary'}>
          {liveRunning ? 'Parar realtime' : 'Iniciar realtime'}
        </AppButton>
        <AppButton disabled={loading} icon="⌕" onPress={identifyVehicle} tone="secondary">Identificar veiculo</AppButton>
        <AppButton disabled={loading} icon={showOptions ? '-' : '+'} onPress={() => setShowOptions((value) => !value)} tone="secondary">Opcoes</AppButton>
        {showOptions ? <Text style={styles.muted}>Realtime sem intervalo fixo: cada sensor atualiza assim que a ECU responde.</Text> : null}
      </Panel>

      {fingerprint ? <FingerprintPanel fingerprint={fingerprint} /> : null}

      <View style={styles.grid}>
        {readings.length ? readings.map((reading) => <ReadingCard key={reading.pid} reading={reading} />) : (
          <Text style={styles.muted}>Nenhuma leitura realizada nesta sessao.</Text>
        )}
      </View>

      {communicationLog.length ? (
        <Panel title="Log OBD2">
          {communicationLog.slice(-18).map((line, index) => (
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
      {fingerprint.vin ? <Text style={styles.muted}>VIN/chassi: {fingerprint.vin}</Text> : null}
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
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${readingPercent(reading)}%` }]} />
      </View>
    </View>
  );
}

function VehicleHero({ vehicle }: { vehicle: Vehicle }) {
  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
  const imageUrl = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(`${title} car side view`)}`;

  return (
    <View style={styles.hero}>
      <Image source={{ uri: imageUrl }} style={styles.heroImage} />
      <View style={styles.heroOverlay}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>Imagem temporaria por busca web</Text>
      </View>
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
    minHeight: 128,
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
  fill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 6,
  },
  fingerprintMain: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hero: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  heroOverlay: {
    backgroundColor: 'rgba(11,18,32,0.70)',
    bottom: 0,
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  logLine: {
    color: colors.muted,
    fontFamily: 'monospace',
    fontSize: 12,
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
  track: {
    backgroundColor: colors.panelSoft,
    borderRadius: 999,
    height: 6,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
});

const confidenceLabel: Record<VehicleFingerprint['confidence'], string> = {
  high: 'alta',
  low: 'baixa',
  medium: 'media',
  none: 'nenhuma',
};

const defaultVehicle: Vehicle = {
  id: 'local-focus-2006',
  make: 'Ford',
  model: 'Focus',
  user_id: 'local',
  year: 2006,
};

function ensureVehicle(activeVehicle: Vehicle | undefined, setActiveVehicle: (vehicle: Vehicle) => void) {
  const vehicle = activeVehicle ?? defaultVehicle;
  if (!activeVehicle) {
    setActiveVehicle(vehicle);
  }
  return vehicle;
}

function upsertReading(readings: ObdReading[], reading: ObdReading) {
  const current = readings.filter((item) => item.pid !== reading.pid);
  return [...current, reading].sort((a, b) => a.pid.localeCompare(b.pid));
}

function readingPercent(reading: ObdReading) {
  const maxByPid: Record<string, number> = {
    '0104': 100,
    '0105': 120,
    '010B': 120,
    '010C': 7000,
    '010D': 220,
    '010F': 100,
    '0110': 200,
    '0111': 100,
    '011F': 3600,
    '0121': 1000,
    '0130': 255,
    '0131': 1000,
    '0133': 120,
    '013C': 900,
    '013E': 900,
    '0142': 16,
  };
  const max = maxByPid[reading.pid] ?? 100;
  return Math.max(4, Math.min(100, (reading.value / max) * 100));
}
