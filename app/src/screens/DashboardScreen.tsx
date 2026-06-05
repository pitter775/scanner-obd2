import { Fragment, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  Activity,
  BatteryCharging,
  CarFront,
  CircleGauge,
  Cpu,
  Footprints,
  Gauge,
  Thermometer,
  Timer,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { isCloudSyncEnabled } from '../config/env';
import { colors, spacing } from '../config/theme';
import { getSharedConnection, obdBluetoothErrorMessage } from '../services/bluetoothService';
import { recordDiagnosticEvent } from '../services/diagnosticLog';
import { ObdService } from '../services/obdService';
import { createScanSession, createVehicle, finishScanSession, saveReadings } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { ObdReading, Vehicle, VehicleFingerprint } from '../types/domain';

export function DashboardScreen() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const isWide = width >= 760;
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const appendCommunicationLog = useAppStore((state) => state.appendCommunicationLog);
  const clearCommunicationLog = useAppStore((state) => state.clearCommunicationLog);
  const communicationLog = useAppStore((state) => state.communicationLog);
  const connectionReady = useAppStore((state) => state.connectionReady);
  const fingerprint = useAppStore((state) => state.fingerprint);
  const mockMode = useAppStore((state) => state.mockMode);
  const readings = useAppStore((state) => state.readings);
  const recordingTrip = useAppStore((state) => state.recordingTrip);
  const recordTripFrame = useAppStore((state) => state.recordTripFrame);
  const setActiveVehicle = useAppStore((state) => state.setActiveVehicle);
  const setFingerprint = useAppStore((state) => state.setFingerprint);
  const setReadings = useAppStore((state) => state.setReadings);
  const startLocalTrip = useAppStore((state) => state.startLocalTrip);
  const stopLocalTrip = useAppStore((state) => state.stopLocalTrip);
  const [loading, setLoading] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [tripBusy, setTripBusy] = useState(false);
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [liveRunning, setLiveRunning] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleEngine, setVehicleEngine] = useState('');
  const liveSessionIdRef = useRef<string | null>(null);
  const liveRunningRef = useRef(false);
  const liveFinalStatusRef = useRef<'finished' | 'failed'>('finished');
  const initializedRef = useRef(false);
  const retryAfterErrorRef = useRef(false);
  const tripSnapshotInFlightRef = useRef(false);

  useEffect(() => () => {
    liveRunningRef.current = false;
  }, []);

  useEffect(() => {
    if (mockMode) {
      const startedAt = Date.now();
      liveRunningRef.current = false;
      setLoading(false);
      setStatusMessage('');
      setLiveRunning(true);
      setActiveVehicle(mockVehicle);
      setFingerprint(mockFingerprint);
      appendCommunicationLog('Mock OBD2 ativo: leituras simuladas para testar o dashboard.');

      const updateMockReadings = () => {
        setReadings(createMockReadings((Date.now() - startedAt) / 1000));
      };

      updateMockReadings();
      const interval = setInterval(updateMockReadings, 900);
      return () => {
        clearInterval(interval);
        setLiveRunning(false);
      };
    }

    if (!connectionReady) {
      navigation.navigate('Bluetooth' as never);
      return;
    }

    if (!activeAdapter || liveRunningRef.current) {
      return;
    }

    void startLiveDiagnostic();

    return () => {
      liveRunningRef.current = false;
    };
  }, [activeAdapter?.address, mockMode]);

  async function startLiveDiagnostic() {
    const vehicle = ensureVehicle(activeVehicle, setActiveVehicle);

    if (!activeAdapter || !connectionReady) {
      return;
    }

    setLoading(true);
    setStatusMessage('');
    clearCommunicationLog();

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      const obd = new ObdService(connection);
      if (!initializedRef.current) {
        await obd.initialize();
        initializedRef.current = true;
      }
      appendCommunicationLog('Realtime iniciado: log bruto completo fica no relatório/debug.');

      if (isCloudSyncEnabled) {
        const session = await createScanSession(vehicle.id, activeAdapter.name, activeAdapter.address);
        liveSessionIdRef.current = session.id;
      }

      liveRunningRef.current = true;
      liveFinalStatusRef.current = 'finished';
      setLiveRunning(true);

      let frameIndex = 0;
      while (liveRunningRef.current) {
        const nextReadings = await obd.readRealtimeFrame(frameIndex, (reading) => setReadings(upsertReading(useAppStore.getState().readings, reading)));
        frameIndex += 1;

        if (isCloudSyncEnabled && liveSessionIdRef.current) {
          await saveReadings(liveSessionIdRef.current, nextReadings);
        }
        void recordTripSnapshot(nextReadings);
      }
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha na leitura continua OBD2', error);
      liveFinalStatusRef.current = 'failed';
      if (!useAppStore.getState().readings.length) {
        setStatusMessage(obdBluetoothErrorMessage(error));
      } else {
        retryAfterErrorRef.current = true;
      }
    } finally {
      if (isCloudSyncEnabled && liveSessionIdRef.current) {
        await finishScanSession(liveSessionIdRef.current, liveFinalStatusRef.current);
      }
      liveSessionIdRef.current = null;
      liveRunningRef.current = false;
      setLiveRunning(false);
      setLoading(false);
      if (retryAfterErrorRef.current) {
        retryAfterErrorRef.current = false;
        setTimeout(() => {
          if (useAppStore.getState().connectionReady && !liveRunningRef.current) {
            void startLiveDiagnostic();
          }
        }, 700);
      }
    }
  }

  function openVehicleModal() {
    if (activeVehicle && activeVehicle.id !== defaultVehicle.id) {
      setVehicleMake(activeVehicle.make);
      setVehicleModel(activeVehicle.model);
      setVehicleYear(String(activeVehicle.year));
      setVehicleEngine(activeVehicle.engine ?? '');
    } else {
      setVehicleMake(fingerprint?.likelyMake ?? '');
      setVehicleModel('');
      setVehicleYear(fingerprint?.likelyYear ? String(fingerprint.likelyYear) : '');
      setVehicleEngine('');
    }
    setVehicleModalOpen(true);
  }

  async function saveVehicleFromModal() {
    const payload = {
      engine: vehicleEngine.trim(),
      make: vehicleMake.trim(),
      model: vehicleModel.trim(),
      notes: null,
      plate: null,
      vin: fingerprint?.vin ?? null,
      year: Number(vehicleYear),
    };

    if (!payload.make || !payload.model || !payload.year) {
      setStatusMessage('Informe marca, modelo e ano do veículo.');
      return;
    }

    setSavingVehicle(true);
    try {
      if (isCloudSyncEnabled) {
        setActiveVehicle(await createVehicle(payload));
      } else {
        setActiveVehicle({
          ...payload,
          id: `local-${Date.now()}`,
          user_id: 'local',
        });
      }
      setVehicleModalOpen(false);
      setStatusMessage('');
    } catch (error) {
      recordDiagnosticEvent('warn', 'Falha ao salvar veículo em nuvem, usando local', error);
      setActiveVehicle({
        ...payload,
        id: `local-${Date.now()}`,
        user_id: 'local',
      });
      setVehicleModalOpen(false);
    } finally {
      setSavingVehicle(false);
    }
  }

  async function toggleTripRecording() {
    if (recordingTrip) {
      setTripBusy(true);
      try {
        await stopLocalTrip();
        setStatusMessage('Volta salva no historico local.');
      } finally {
        setTripBusy(false);
      }
      return;
    }

    setTripName('');
    setTripNotes('');
    setTripModalOpen(true);
  }

  async function startTripFromModal() {
    const name = tripName.trim();
    if (!name) {
      setStatusMessage('Informe um nome para a gravacao.');
      return;
    }

    setTripBusy(true);
    try {
      await startLocalTrip({ name, notes: tripNotes });
      setTripModalOpen(false);
      setStatusMessage('Gravacao da volta iniciada.');
    } finally {
      setTripBusy(false);
    }
  }

  async function recordTripSnapshot(nextReadings: ObdReading[]) {
    const trip = useAppStore.getState().recordingTrip;
    if (!trip) {
      return;
    }

    if (tripSnapshotInFlightRef.current) {
      return;
    }

    const lastPoint = trip.points[trip.points.length - 1];
    if (lastPoint && Date.now() - new Date(lastPoint.at).getTime() < 4000) {
      return;
    }

    tripSnapshotInFlightRef.current = true;
    let coordinates: { latitude: number; longitude: number } | null = null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }
    } catch (error) {
      recordDiagnosticEvent('warn', 'Falha ao capturar GPS da volta', error);
    }

    try {
      await recordTripFrame(nextReadings, coordinates);
    } finally {
      tripSnapshotInFlightRef.current = false;
    }
  }

  const compactTelemetry = liveRunning || readings.length > 0;
  const performanceMode = Boolean(recordingTrip);
  const rpmReading = readings.find((reading) => reading.pid === '010C');
  const regularReadings = readings.filter((reading) => reading.pid !== '010C');

  return (
    <Screen>
      <View style={[styles.topLayout, isWide && styles.topLayoutWide]}>
        <View style={isWide ? styles.topImageColumnWide : undefined}>
          <VehicleHero compact={compactTelemetry} fingerprint={fingerprint} onPress={openVehicleModal} vehicle={activeVehicle} />
        </View>
        {statusMessage && !readings.length ? (
          <View style={isWide ? styles.topControlsColumnWide : undefined}>
            <View style={styles.controlStrip}>
              <Text style={styles.statusMessage}>{statusMessage}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {fingerprint ? <FingerprintPanel compact={compactTelemetry} fingerprint={fingerprint} /> : null}

      <Panel title="Volta local">
        <Text style={styles.muted}>
          {recordingTrip ? `Gravando ${recordingTrip.name}: ${recordingTrip.points.length} pontos.` : 'Grave uma volta no aparelho para ver mapa, exportar e comparar depois.'}
        </Text>
        <AppButton disabled={tripBusy || (!recordingTrip && !readings.length)} icon={recordingTrip ? 'pause' : 'play'} onPress={toggleTripRecording} tone={recordingTrip ? 'danger' : 'secondary'}>
          {recordingTrip ? 'Parar e salvar volta' : 'Gravar volta'}
        </AppButton>
      </Panel>

      <View style={styles.grid}>
        {rpmReading ? <RpmGauge compact={isWide} performanceMode={performanceMode} reading={rpmReading} /> : null}
        {regularReadings.length ? regularReadings.map((reading) => <ReadingCard key={reading.pid} compact={isWide} performanceMode={performanceMode} reading={reading} />) : null}
        {!readings.length ? (
          <Text style={styles.muted}>Aguardando primeiras leituras da ECU.</Text>
        ) : null}
      </View>

      {communicationLog.length ? (
        <Panel title="Log OBD2">
          {communicationLog.slice(-18).map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
          ))}
        </Panel>
      ) : null}

      <VehicleModal
        engine={vehicleEngine}
        loading={savingVehicle}
        make={vehicleMake}
        model={vehicleModel}
        onClose={() => setVehicleModalOpen(false)}
        onSave={saveVehicleFromModal}
        open={vehicleModalOpen}
        setEngine={setVehicleEngine}
        setMake={setVehicleMake}
        setModel={setVehicleModel}
        setYear={setVehicleYear}
        year={vehicleYear}
      />
      <TripStartModal
        loading={tripBusy}
        name={tripName}
        notes={tripNotes}
        onClose={() => setTripModalOpen(false)}
        onSave={startTripFromModal}
        open={tripModalOpen}
        setName={setTripName}
        setNotes={setTripNotes}
      />
    </Screen>
  );
}

function FingerprintPanel({ compact, fingerprint }: { compact: boolean; fingerprint: VehicleFingerprint }) {
  const protocol = normalizeFingerprintText(fingerprint.protocol);

  if (compact) {
    if (!fingerprint.vin && !protocol) {
      return null;
    }

    return (
      <View style={styles.fingerprintStrip}>
        <Text style={styles.fingerprintStripText}>
          {fingerprint.vin ? `VIN ${fingerprint.vin}` : `Protocolo ${protocol}`}
        </Text>
      </View>
    );
  }

  return (
    <Panel title="Filtro do veículo">
      <Text style={styles.fingerprintMain}>
        {fingerprint.likelyMake ?? 'Marca não identificada'}
        {fingerprint.likelyYear ? ` - ${fingerprint.likelyYear}` : ''}
      </Text>
      <Text style={styles.muted}>Confiança: {confidenceLabel[fingerprint.confidence]}</Text>
      {fingerprint.vin ? <Text style={styles.muted}>VIN/chassi: {fingerprint.vin}</Text> : null}
      {protocol ? <Text style={styles.muted}>Protocolo: {protocol}</Text> : null}
      {fingerprint.calibrationIds.length ? <Text style={styles.muted}>Calibração: {fingerprint.calibrationIds.join(', ')}</Text> : null}
      {fingerprint.ecuNames.length ? <Text style={styles.muted}>ECU: {fingerprint.ecuNames.join(', ')}</Text> : null}
    </Panel>
  );
}

function ReadingCard({ compact, performanceMode, reading }: { compact: boolean; performanceMode: boolean; reading: ObdReading }) {
  const valueScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (performanceMode) {
      valueScale.setValue(1);
      return;
    }

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
  }, [performanceMode, reading.value, valueScale]);

  const barWidth = `${readingPercent(reading)}%` as const;
  const stateColor = readingStateColor(reading);
  const stateLabel = readingStateLabel(reading);

  return (
    <Animated.View style={[styles.card, compact ? styles.cardWide : styles.cardPhone, performanceMode && styles.cardPerformance]}>
      <View pointerEvents="none" style={styles.cardIconPlate}>
        <SensorIcon color={stateColor} pid={reading.pid} size={66} style={styles.cardIcon} />
      </View>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{reading.name}</Text>
        <View style={styles.cardIconBadge}>
          <SensorIcon color={stateColor} pid={reading.pid} size={20} />
        </View>
      </View>
      <Text style={[styles.statePill, { backgroundColor: hexToRgba(stateColor, 0.16), color: stateColor }]}>{stateLabel}</Text>
      <Animated.Text style={[styles.cardValue, performanceMode && styles.valuePerformance, { color: stateColor, textShadowColor: performanceMode ? 'transparent' : stateColor, transform: [{ scale: valueScale }] }]}>{reading.value}</Animated.Text>
      <Text style={[styles.cardUnit, { color: stateColor }]}>{reading.unit}</Text>
      <View style={styles.track}>
        {!performanceMode ? <View style={[styles.fillGlow, { backgroundColor: stateColor, width: barWidth }]} /> : null}
        <View style={[styles.fill, { backgroundColor: stateColor, width: barWidth }]} />
      </View>
      {!performanceMode ? <View style={styles.segmentRow}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View
            key={index}
            style={[styles.segment, readingPercent(reading) >= (index + 1) * 12 ? { backgroundColor: stateColor } : null]}
          />
        ))}
      </View> : null}
    </Animated.View>
  );
}

function RpmGauge({ compact, performanceMode, reading }: { compact: boolean; performanceMode: boolean; reading: ObdReading }) {
  const valueScale = useRef(new Animated.Value(1)).current;
  const percent = readingPercent(reading);
  const stateColor = readingStateColor(reading);

  useEffect(() => {
    if (performanceMode) {
      valueScale.setValue(1);
      return;
    }

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
  }, [performanceMode, reading.value, valueScale]);

  return (
    <Animated.View style={[styles.rpmGauge, compact ? styles.rpmGaugeWide : styles.rpmGaugePhone, performanceMode && styles.rpmGaugePerformance]}>
      <View style={styles.rpmContent}>
        <Animated.Text style={[styles.rpmValue, performanceMode && styles.valuePerformance, { color: stateColor, textShadowColor: performanceMode ? 'transparent' : stateColor, transform: [{ scale: valueScale }] }]}>{reading.value}</Animated.Text>
        <Text style={[styles.cardUnit, { color: stateColor }]}>{reading.unit}</Text>
        <Text style={[styles.rpmStatus, { color: stateColor }]}>Conta-giros ECU</Text>
        <Text style={styles.rpmHint}>{performanceMode ? 'gravando percurso' : 'normal / alerta / critico'}</Text>
      </View>
      <RpmDial color={stateColor} performanceMode={performanceMode} percent={percent} />
    </Animated.View>
  );
}

function RpmDial({ color, performanceMode, percent }: { color: string; performanceMode: boolean; percent: number }) {
  const center = { x: 108, y: 118 };
  const radius = 86;
  const progressEnd = -130 + (Math.max(0, Math.min(100, percent)) * 2.6);
  const needleEnd = polarToCartesian(center.x, center.y, radius - 14, progressEnd);

  return (
    <View style={styles.rpmDial}>
      <Svg height="148" viewBox="0 0 216 148" width="216">
        <Path d={arcPath(center.x, center.y, radius, -130, 130)} fill="none" stroke={colors.panelSoft} strokeLinecap="round" strokeWidth="14" />
        <Path d={arcPath(center.x, center.y, radius, -130, 0)} fill="none" stroke={colors.success} strokeLinecap="round" strokeWidth="9" />
        <Path d={arcPath(center.x, center.y, radius, 0, 65)} fill="none" stroke={colors.warning} strokeLinecap="round" strokeWidth="9" />
        <Path d={arcPath(center.x, center.y, radius, 65, 130)} fill="none" stroke={colors.danger} strokeLinecap="round" strokeWidth="9" />
        {!performanceMode ? <Path d={arcPath(center.x, center.y, radius - 18, -130, progressEnd)} fill="none" stroke={color} strokeLinecap="round" strokeWidth="5" /> : null}
        {(!performanceMode ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 2, 4, 6, 8]).map((tick) => {
          const angle = -130 + (tick / 8) * 260;
          const start = polarToCartesian(center.x, center.y, radius - 2, angle);
          const end = polarToCartesian(center.x, center.y, radius - 14, angle);
          const label = polarToCartesian(center.x, center.y, radius - 31, angle);
          return (
            <Fragment key={tick}>
              <Line stroke={colors.muted} strokeLinecap="round" strokeWidth="2" x1={start.x} x2={end.x} y1={start.y} y2={end.y} />
              <SvgText fill={colors.muted} fontSize="10" fontWeight="800" textAnchor="middle" x={label.x} y={label.y + 3}>{tick}</SvgText>
            </Fragment>
          );
        })}
        <Line stroke={color} strokeLinecap="round" strokeWidth="7" x1={center.x} x2={needleEnd.x} y1={center.y} y2={needleEnd.y} />
        <Circle cx={center.x} cy={center.y} fill={colors.background} r="13" stroke={color} strokeWidth="6" />
        <SvgText fill={colors.muted} fontSize="9" fontWeight="900" textAnchor="middle" x={center.x} y={center.y + 31}>x1000</SvgText>
      </Svg>
    </View>
  );
}

function SensorIcon({ color = colors.primaryGlow, pid, size = 56, style }: { color?: string; pid: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const Icon = pidIcon(pid);
  return <Icon color={color} pointerEvents="none" size={size} strokeWidth={2.2} style={style} />;
}

function VehicleHero({ compact, fingerprint, onPress, vehicle }: { compact: boolean; fingerprint?: VehicleFingerprint; onPress: () => void; vehicle?: Vehicle }) {
  const title = vehicle && vehicle.id !== defaultVehicle.id
    ? `${vehicle.make} ${vehicle.model} ${vehicle.year}`
    : fingerprint?.likelyMake && fingerprint.likelyYear
      ? `${fingerprint.likelyMake} ${fingerprint.likelyYear}`
      : 'Veículo não identificado';
  const hasVehicleImage = !title.includes('Veículo não identificado');
  const query = `${title} brasileiro foto lateral`;
  const imageUrl = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(query)}`;

  return (
    <Pressable onPress={onPress} style={[styles.hero, compact && styles.heroCompact]}>
      {hasVehicleImage ? <Image source={{ uri: imageUrl }} style={styles.heroImage} /> : null}
      <View style={styles.heroGlow} />
      <View style={styles.heroOverlay}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>Toque para escolher o carro</Text>
      </View>
    </Pressable>
  );
}

function VehicleModal({
  engine,
  loading,
  make,
  model,
  onClose,
  onSave,
  open,
  setEngine,
  setMake,
  setModel,
  setYear,
  year,
}: {
  engine: string;
  loading: boolean;
  make: string;
  model: string;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
  setEngine: (value: string) => void;
  setMake: (value: string) => void;
  setModel: (value: string) => void;
  setYear: (value: string) => void;
  year: string;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>Escolher veículo</Text>
          <VehicleInput label="Marca" onChangeText={setMake} placeholder="ex: Ford" value={make} />
          <VehicleInput label="Modelo" onChangeText={setModel} placeholder="ex: Focus" value={model} />
          <VehicleInput keyboardType="number-pad" label="Ano" onChangeText={setYear} placeholder="ex: 2006" value={year} />
          <VehicleInput label="Motor" onChangeText={setEngine} placeholder="ex: 1.6, 2.0" value={engine} />
          <View style={styles.modalActions}>
            <AppButton disabled={loading} icon="save" onPress={onSave}>Salvar</AppButton>
            <AppButton disabled={loading} icon="chevron-down" onPress={onClose} tone="secondary">Fechar</AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TripStartModal({
  loading,
  name,
  notes,
  onClose,
  onSave,
  open,
  setName,
  setNotes,
}: {
  loading: boolean;
  name: string;
  notes: string;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
  setName: (value: string) => void;
  setNotes: (value: string) => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>Nova gravacao</Text>
          <VehicleInput label="Nome obrigatorio" onChangeText={setName} placeholder="ex: Filtro Original" value={name} />
          <VehicleInput label="Observacao" onChangeText={setNotes} placeholder="ex: Motor quente, teste rodovia" value={notes} />
          <View style={styles.modalActions}>
            <AppButton disabled={loading || !name.trim()} icon="play" onPress={onSave}>Iniciar</AppButton>
            <AppButton disabled={loading} icon="chevron-down" onPress={onClose} tone="secondary">Fechar</AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function VehicleInput({
  autoCapitalize,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={styles.vehicleInputWrap}>
      <Text style={styles.vehicleInputLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.vehicleInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  cardPerformance: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  cardLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  cardIcon: {
    opacity: 0.42,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 36,
    zIndex: 1,
  },
  cardIconBadge: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  cardIconPlate: {
    alignItems: 'center',
    height: 104,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 18,
    width: 114,
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
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,7,18,0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    maxWidth: 520,
    padding: spacing.md,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  rpmDial: {
    alignItems: 'center',
    height: 148,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xs,
    top: spacing.md,
    width: 216,
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
  rpmGaugePerformance: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  rpmGaugePhone: {
    flexBasis: '100%',
  },
  rpmGaugeWide: {
    flexBasis: '48.5%',
  },
  rpmContent: {
    maxWidth: '48%',
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
  rpmStatus: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  rpmHint: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    maxWidth: 180,
    textTransform: 'uppercase',
  },
  valuePerformance: {
    textShadowRadius: 0,
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
  statePill: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: '900',
    marginTop: spacing.xs,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: 'uppercase',
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
  vehicleInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  vehicleInputLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  vehicleInputWrap: {
    gap: spacing.xs,
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
  make: 'Veículo',
  model: 'não identificado',
  user_id: 'local',
  year: new Date().getFullYear(),
};

const mockVehicle: Vehicle = {
  engine: 'Simulado',
  id: 'local-mock-vehicle',
  make: 'Mock',
  model: 'Dashboard',
  plate: 'PITTER',
  user_id: 'local',
  vin: 'MOCK494601DASH',
  year: 2026,
};

const mockFingerprint: VehicleFingerprint = {
  calibrationIds: ['MOCK-DASH'],
  confidence: 'high',
  cvns: ['494601'],
  ecuNames: ['ECU Mock Desktop'],
  likelyMake: 'Mock',
  likelyModel: 'Dashboard',
  likelyYear: 2026,
  protocol: 'ISO 15765-4 CAN mock',
  raw: {
    '0100': '41 00 BE 3E B8 13',
    '0902': '49 02 01 4D 4F 43 4B',
  },
  supportedPids01: 'BE3EB813',
  supportedPids21: null,
  vin: 'MOCK494601DASH',
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

function createMockReadings(seconds: number): ObdReading[] {
  const wave = (Math.sin(seconds) + 1) / 2;
  const fastWave = (Math.sin(seconds * 1.8) + 1) / 2;
  const heatPulse = (Math.sin(seconds / 5) + 1) / 2;
  const rpm = Math.round(850 + (wave * 2600) + (fastWave > 0.82 ? 1200 : 0));
  const speed = Math.round(Math.max(0, (rpm - 900) / 34));
  const coolant = Number((76 + heatPulse * 27).toFixed(1));
  const load = Number((18 + wave * 64).toFixed(2));
  const throttle = Number((8 + fastWave * 58).toFixed(2));
  const manifold = Math.round(28 + wave * 62);
  const intake = Number((22 + heatPulse * 22).toFixed(1));
  const maf = Number((3.2 + (rpm / 8000) * 68).toFixed(2));
  const runtime = Math.round(102 + seconds);
  const voltage = Number((13.4 + Math.sin(seconds / 3) * 0.55).toFixed(2));

  return [
    mockReading('010C', 'RPM', rpm, 'rpm'),
    mockReading('010D', 'Velocidade', speed, 'km/h'),
    mockReading('0105', 'Temperatura do motor', coolant, '°C'),
    mockReading('0104', 'Carga do motor', load, '%'),
    mockReading('0111', 'Borboleta', throttle, '%'),
    mockReading('010F', 'Temperatura do ar', intake, '°C'),
    mockReading('010B', 'Pressão coletor', manifold, 'kPa'),
    mockReading('0142', 'Tensão módulo', voltage, 'V'),
    mockReading('0110', 'Fluxo de ar', maf, 'g/s'),
    mockReading('011F', 'Tempo ligado', runtime, 's'),
  ];
}

function mockReading(pid: string, name: string, value: number, unit: string): ObdReading {
  return {
    name,
    pid,
    rawResponse: `MOCK ${pid} ${value}`,
    unit,
    value,
  };
}

function readingPercent(reading: ObdReading) {
  const maxByPid: Record<string, number> = {
    '0104': 100,
    '0105': 120,
    '010B': 120,
    '010C': 8000,
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

function readingStateColor(reading: ObdReading) {
  const value = reading.value;

  if (reading.pid === '010C') {
    if (value >= 6000) return colors.danger;
    if (value >= 4000) return colors.warning;
    return colors.primaryGlow;
  }

  if (['0105', '013C', '013E'].includes(reading.pid)) {
    if (value >= 105) return colors.danger;
    if (value >= 95) return colors.warning;
    if (value <= 55) return colors.electric;
    return colors.success;
  }

  if (reading.pid === '010F') {
    if (value >= 70) return colors.warning;
    if (value <= 15) return colors.electric;
    return colors.primaryGlow;
  }

  if (['0104', '0111'].includes(reading.pid)) {
    if (value >= 90) return colors.danger;
    if (value >= 70) return colors.warning;
    return colors.primaryGlow;
  }

  if (reading.pid === '0142') {
    if (value < 11.8 || value > 15.2) return colors.danger;
    if (value < 12.4 || value > 14.8) return colors.warning;
    return colors.success;
  }

  return colors.primaryGlow;
}

function readingStateLabel(reading: ObdReading) {
  const color = readingStateColor(reading);

  if (color === colors.danger) return 'critico';
  if (color === colors.warning) return 'atenção';
  if (color === colors.electric) return 'frio';
  if (color === colors.success) return 'normal';
  return 'leitura';
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians)),
  };
}

function arcPath(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function normalizeFingerprintText(value?: string | null) {
  if (!value || /STOPPED|NULL/i.test(value)) {
    return '';
  }

  return value;
}

function pidIcon(pid: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    '0104': Cpu,
    '0105': Thermometer,
    '010B': Gauge,
    '010C': CircleGauge,
    '010D': CarFront,
    '010F': Thermometer,
    '0110': Wind,
    '0111': Footprints,
    '011F': Timer,
    '0121': Gauge,
    '0130': Activity,
    '0131': Gauge,
    '0133': Gauge,
    '013C': Thermometer,
    '013E': Thermometer,
    '0142': BatteryCharging,
  };
  return icons[pid] ?? Activity;
}
