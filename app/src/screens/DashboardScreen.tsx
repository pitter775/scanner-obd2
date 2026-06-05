import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { ConnectionGauge } from '../components/ConnectionGauge';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { isCloudSyncEnabled } from '../config/env';
import { colors, spacing } from '../config/theme';
import { getSharedConnection, obdBluetoothErrorMessage, type BluetoothConnection } from '../services/bluetoothService';
import { recordDiagnosticEvent } from '../services/diagnosticLog';
import { ObdService } from '../services/obdService';
import { createScanSession, finishScanSession, saveReadings, saveVehicleFingerprint } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { ObdReading, Vehicle, VehicleFingerprint } from '../types/domain';

export function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
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
  const [controlsExpanded, setControlsExpanded] = useState(false);
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
      if (!fingerprint) {
        setFingerprint(await obd.identifyVehicleFast());
      }
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
      const obd = new ObdService(connection);
      await obd.initialize();
      if (!fingerprint) {
        setFingerprint(await obd.identifyVehicleFast());
      }
      appendCommunicationLog('Realtime iniciado: log bruto completo fica no relatorio/debug.');

      if (isCloudSyncEnabled) {
        const session = await createScanSession(vehicle.id, activeAdapter.name, activeAdapter.address);
        liveSessionIdRef.current = session.id;
      }

      liveRunningRef.current = true;
      liveFinalStatusRef.current = 'finished';
      setLiveRunning(true);

      let frameIndex = 0;
      while (liveRunningRef.current) {
        setLoadingLabel('Atualizando sensores...');
        const nextReadings = await obd.readRealtimeFrame(frameIndex, (reading) => setReadings(upsertReading(useAppStore.getState().readings, reading)));
        frameIndex += 1;

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

  const compactControls = !controlsExpanded && (liveRunning || readings.length > 0);
  const rpmReading = readings.find((reading) => reading.pid === '010C');
  const regularReadings = readings.filter((reading) => reading.pid !== '010C');

  return (
    <Screen>
      <View style={[styles.topLayout, isWide && styles.topLayoutWide]}>
        <View style={isWide ? styles.topImageColumnWide : undefined}>
          <VehicleHero compact={compactControls} fingerprint={fingerprint} vehicle={activeVehicle} />
        </View>
        <View style={isWide ? styles.topControlsColumnWide : undefined}>
          <View style={styles.controlStrip}>
            {!compactControls ? <ConnectionGauge active={loading} label={loadingLabel} moduleName={activeAdapter?.name ?? 'OBDII'} /> : null}
            {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
            <View style={styles.actionGrid}>
              <AppButton compact disabled={loading} icon="*" onPress={startDiagnostic}>Ler</AppButton>
              <AppButton disabled={loading && !liveRunning} icon={liveRunning ? '[]' : '>'} onPress={liveRunning ? stopLiveDiagnostic : startLiveDiagnostic} tone={liveRunning ? 'danger' : 'secondary'}>
                {liveRunning ? 'Parar realtime' : 'Realtime'}
              </AppButton>
              <AppButton compact disabled={loading} icon={controlsExpanded ? '-' : '+'} onPress={() => setControlsExpanded((value) => !value)} tone="secondary">
                {controlsExpanded ? 'Reduzir' : 'Expandir'}
              </AppButton>
            </View>
            {!readings.length ? <Text style={styles.engineHint}>Ligue o carro. Alguns sensores so respondem com o motor ligado ou chave em ignicao.</Text> : null}
          </View>
        </View>
      </View>

      {fingerprint ? <FingerprintPanel compact={compactControls} fingerprint={fingerprint} /> : null}

      <View style={styles.grid}>
        {rpmReading ? <RpmGauge compact={isWide} reading={rpmReading} /> : null}
        {regularReadings.length ? regularReadings.map((reading) => <ReadingCard key={reading.pid} compact={isWide} reading={reading} />) : null}
        {!readings.length ? (
          <Text style={styles.muted}>Nenhuma leitura realizada nesta sessao.</Text>
        ) : null}
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

function FingerprintPanel({ compact, fingerprint }: { compact: boolean; fingerprint: VehicleFingerprint }) {
  if (compact) {
    return (
      <View style={styles.fingerprintStrip}>
        <Text style={styles.fingerprintStripText}>
          {fingerprint.vin ? `VIN ${fingerprint.vin}` : `Protocolo ${fingerprint.protocol ?? 'nao identificado'}`}
        </Text>
      </View>
    );
  }

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

function ReadingCard({ compact, reading }: { compact: boolean; reading: ObdReading }) {
  const valueScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(valueScale, {
        friction: 5,
        tension: 160,
        toValue: 1.06,
        useNativeDriver: true,
      }),
      Animated.spring(valueScale, {
        friction: 6,
        tension: 120,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reading.value, valueScale]);

  const barWidth = `${readingPercent(reading)}%` as const;

  return (
    <Animated.View style={[styles.card, compact ? styles.cardWide : styles.cardPhone]}>
      <Text pointerEvents="none" style={styles.cardIcon}>{pidIcon(reading.pid)}</Text>
      <View pointerEvents="none" style={styles.cardHalo} />
      <Text style={styles.cardLabel}>{reading.name}</Text>
      <Animated.Text style={[styles.cardValue, { transform: [{ scale: valueScale }] }]}>{reading.value}</Animated.Text>
      <Text style={styles.cardUnit}>{reading.unit}</Text>
      <View style={styles.track}>
        <View style={[styles.fillGlow, { width: barWidth }]} />
        <View style={[styles.fill, { width: barWidth }]} />
      </View>
      <View style={styles.segmentRow}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View key={index} style={[styles.segment, readingPercent(reading) >= (index + 1) * 12 ? styles.segmentActive : null]} />
        ))}
      </View>
    </Animated.View>
  );
}

function RpmGauge({ compact, reading }: { compact: boolean; reading: ObdReading }) {
  const valueScale = useRef(new Animated.Value(1)).current;
  const percent = readingPercent(reading);
  const needleAngle = `${Math.max(-125, Math.min(125, -125 + (percent * 2.5)))}deg`;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(valueScale, {
        friction: 5,
        tension: 180,
        toValue: 1.04,
        useNativeDriver: true,
      }),
      Animated.spring(valueScale, {
        friction: 6,
        tension: 130,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reading.value, valueScale]);

  return (
    <Animated.View style={[styles.rpmGauge, compact ? styles.rpmGaugeWide : styles.rpmGaugePhone]}>
      <Text pointerEvents="none" style={styles.rpmIcon}>RPM</Text>
      <View style={styles.rpmArc}>
        <View style={styles.rpmArcInner} />
        <View style={[styles.rpmNeedle, { transform: [{ rotate: needleAngle }] }]} />
        <View style={styles.rpmCenter} />
      </View>
      <Animated.Text style={[styles.rpmValue, { transform: [{ scale: valueScale }] }]}>{reading.value}</Animated.Text>
      <Text style={styles.cardUnit}>{reading.unit}</Text>
      <View style={styles.track}>
        <View style={[styles.fillGlow, { width: `${percent}%` as const }]} />
        <View style={[styles.fill, { width: `${percent}%` as const }]} />
      </View>
    </Animated.View>
  );
}

function VehicleHero({ compact, fingerprint, vehicle }: { compact: boolean; fingerprint?: VehicleFingerprint; vehicle?: Vehicle }) {
  const title = vehicle && vehicle.id !== defaultVehicle.id
    ? `${vehicle.make} ${vehicle.model} ${vehicle.year}`
    : fingerprint?.likelyMake && fingerprint.likelyYear
      ? `${fingerprint.likelyMake} ${fingerprint.likelyYear}`
      : 'Veiculo nao identificado';
  const query = title.includes('Veiculo nao identificado') ? 'car dashboard obd2 scanner' : `${title} brasileiro foto lateral`;
  const imageUrl = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(query)}`;

  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <Image source={{ uri: imageUrl }} style={styles.heroImage} />
      <View style={styles.heroGlow} />
      <View style={styles.heroOverlay}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>Imagem temporaria por busca web</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 142,
    overflow: 'hidden',
    padding: spacing.md,
    shadowColor: colors.primaryGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHalo: {
    backgroundColor: colors.primary,
    borderRadius: 80,
    height: 96,
    opacity: 0.16,
    position: 'absolute',
    right: -38,
    top: -34,
    width: 96,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  cardIcon: {
    color: colors.primaryGlow,
    fontSize: 40,
    fontWeight: '900',
    opacity: 0.08,
    position: 'absolute',
    right: spacing.sm,
    top: spacing.xs,
  },
  cardPhone: {
    flexBasis: '48%',
  },
  cardUnit: {
    color: colors.primaryGlow,
    fontSize: 13,
    fontWeight: '900',
  },
  cardValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginVertical: spacing.xs,
    textShadowColor: colors.primaryGlow,
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 12,
  },
  cardWide: {
    flexBasis: '23.5%',
  },
  fill: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 999,
    height: 7,
    position: 'absolute',
  },
  fillGlow: {
    backgroundColor: colors.electric,
    borderRadius: 999,
    height: 13,
    opacity: 0.32,
    position: 'absolute',
    top: -3,
  },
  engineHint: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.warning,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
    padding: spacing.sm,
  },
  fingerprintMain: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  fingerprintStrip: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fingerprintStripText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hero: {
    aspectRatio: 21 / 9,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: colors.electric,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 1,
  },
  heroCompact: {
    aspectRatio: 28 / 9,
  },
  heroGlow: {
    backgroundColor: colors.primary,
    bottom: -90,
    height: 150,
    left: -40,
    opacity: 0.22,
    position: 'absolute',
    right: -40,
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  heroOverlay: {
    backgroundColor: 'rgba(11,18,32,0.68)',
    bottom: 0,
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: colors.primaryGlow,
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 10,
  },
  logLine: {
    color: colors.muted,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  muted: {
    color: colors.muted,
  },
  rpmArc: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 90,
    borderTopColor: colors.primaryGlow,
    borderWidth: 10,
    height: 150,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 150,
  },
  rpmArcInner: {
    borderColor: colors.borderStrong,
    borderRadius: 68,
    borderWidth: 1,
    height: 118,
    opacity: 0.7,
    position: 'absolute',
    width: 118,
  },
  rpmCenter: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  rpmGauge: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 180,
    overflow: 'hidden',
    padding: spacing.md,
    shadowColor: colors.primaryGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  rpmGaugePhone: {
    flexBasis: '100%',
  },
  rpmGaugeWide: {
    flexBasis: '48.5%',
  },
  rpmIcon: {
    color: colors.primaryGlow,
    fontSize: 54,
    fontWeight: '900',
    opacity: 0.07,
    position: 'absolute',
    right: spacing.md,
    top: spacing.sm,
  },
  rpmNeedle: {
    backgroundColor: colors.danger,
    borderRadius: 3,
    height: 6,
    left: 28,
    position: 'absolute',
    width: 64,
  },
  rpmValue: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    marginTop: spacing.lg,
    textShadowColor: colors.primaryGlow,
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 14,
  },
  segment: {
    backgroundColor: colors.border,
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
  segmentActive: {
    backgroundColor: colors.primaryGlow,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.sm,
  },
  statusMessage: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.warning,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
    padding: spacing.md,
  },
  topColumnWide: {
    flex: 1,
  },
  topControlsColumnWide: {
    flex: 0.8,
  },
  topImageColumnWide: {
    flex: 1.2,
  },
  topLayout: {
    gap: spacing.sm,
  },
  topLayoutWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  controlStrip: {
    backgroundColor: 'transparent',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  track: {
    backgroundColor: colors.panelSoft,
    borderRadius: 999,
    height: 7,
    marginTop: spacing.sm,
    overflow: 'visible',
  },
});

const confidenceLabel: Record<VehicleFingerprint['confidence'], string> = {
  high: 'alta',
  low: 'baixa',
  medium: 'media',
  none: 'nenhuma',
};

const defaultVehicle: Vehicle = {
  id: 'local-unknown-vehicle',
  make: 'Veiculo',
  model: 'nao identificado',
  user_id: 'local',
  year: new Date().getFullYear(),
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

function pidIcon(pid: string) {
  const icons: Record<string, string> = {
    '0104': '%',
    '0105': 'C',
    '010B': 'kPa',
    '010D': 'km/h',
    '010F': 'C',
    '0110': 'MAF',
    '0111': '%',
    '011F': 's',
    '0121': 'km',
    '0130': '#',
    '0131': 'km',
    '0133': 'kPa',
    '013C': 'C',
    '013E': 'C',
    '0142': 'V',
  };
  return icons[pid] ?? 'OBD';
}
