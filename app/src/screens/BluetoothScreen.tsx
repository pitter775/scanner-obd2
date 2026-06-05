import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { ConnectionGauge } from '../components/ConnectionGauge';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { listAvailableDevices, listPairedDevices, obdBluetoothErrorMessage, pairBluetoothDevice, testAdapterHandshake } from '../services/bluetoothService';
import { recordDiagnosticEvent, shareDiagnosticReport } from '../services/diagnosticLog';
import { useAppStore } from '../store/appStore';
import type { BluetoothDeviceInfo } from '../types/domain';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Bluetooth'>;

export function BluetoothScreen({ navigation }: Props) {
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const connectionReady = useAppStore((state) => state.connectionReady);
  const setActiveAdapter = useAppStore((state) => state.setActiveAdapter);
  const setConnectionReady = useAppStore((state) => state.setConnectionReady);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [lastAdapter, setLastAdapter] = useState<BluetoothDeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState('Busque e conecte o adaptador OBD2 antes de continuar.');

  useEffect(() => {
    AsyncStorage.getItem('last-obd-adapter')
      .then((value) => {
        if (value) {
          setLastAdapter(JSON.parse(value) as BluetoothDeviceInfo);
        }
      })
      .catch((error) => recordDiagnosticEvent('warn', 'Falha ao carregar ultimo adaptador', error));
  }, []);

  async function loadDevices() {
    setLoading(true);
    appendConsole('Listando dispositivos pareados');
    try {
      const nextDevices = await listPairedDevices();
      setDevices(sortObdCandidates(nextDevices));
      appendConsole(`Encontrados: ${nextDevices.length}`);
      setStatus(nextDevices.length ? 'Selecione o OBDII ou outro adaptador OBD2 pareado.' : 'Nenhum dispositivo pareado encontrado.');
    } catch (error) {
      appendConsole(`Erro ao listar: ${errorMessage(error)}`);
      recordDiagnosticEvent('error', 'Falha ao listar dispositivos Bluetooth', error);
      setStatus(bluetoothErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function discoverDevices() {
    setLoading(true);
    appendConsole('Buscando dispositivos proximos');
    try {
      const nextDevices = await listAvailableDevices();
      setAvailableDevices(sortObdCandidates(nextDevices));
      appendConsole(`Disponiveis: ${nextDevices.length}`);
      setStatus(nextDevices.length ? 'Toque no OBDII para parear. Depois toque nele em pareados para conectar.' : 'Nenhum dispositivo novo encontrado.');
    } catch (error) {
      appendConsole(`Erro ao buscar proximos: ${errorMessage(error)}`);
      recordDiagnosticEvent('error', 'Falha ao buscar dispositivos Bluetooth proximos', error);
      setStatus(bluetoothErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function pairDevice(device: BluetoothDeviceInfo) {
    setLoading(true);
    setConnectingDeviceId(device.id);
    appendConsole(`Pareando ${device.name} (${device.address})`);
    try {
      const paired = await pairBluetoothDevice(device.address);
      appendConsole('Pareado. Conectando agora.');
      await loadDevices();
      await connectDevice({
        id: paired.id || device.id,
        name: paired.name || device.name,
        address: paired.address || device.address,
      });
    } catch (error) {
      appendConsole(`Erro ao parear: ${errorMessage(error)}`);
      recordDiagnosticEvent('error', `Falha ao parear ${device.name}`, error);
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
      setConnectingDeviceId(null);
    }
  }

  async function connectDevice(device: BluetoothDeviceInfo) {
    setLoading(true);
    setConnectingDeviceId(device.id);
    setConnectionReady(false);
    setConsoleLines([]);
    setStatus(`Conectando em ${device.name}...`);
    appendConsole(`Selecionado ${device.name} (${device.address})`);

    try {
      const response = await testAdapterHandshake(device.address, appendConsole);
      setActiveAdapter(device);
      setConnectionReady(true);
      setLastAdapter(device);
      await AsyncStorage.setItem('last-obd-adapter', JSON.stringify(device));
      setStatus(`${device.name} conectado. Resposta: ${response.slice(0, 40)}`);
      navigation.replace('Dashboard');
    } catch (error) {
      appendConsole(`Falha final: ${errorMessage(error)}`);
      recordDiagnosticEvent('error', `Falha ao validar adaptador ${device.name}`, error);
      const message = obdBluetoothErrorMessage(error);
      setStatus(message);
    } finally {
      setLoading(false);
      setConnectingDeviceId(null);
    }
  }

  return (
    <Screen>
      {lastAdapter ? (
        <Panel subtitle="Usa o último scanner que funcionou, sem procurar de novo." title="Conexão rápida">
          <Text style={styles.value}>{lastAdapter.name}</Text>
          <Text style={styles.muted}>{lastAdapter.address}</Text>
          <AppButton disabled={loading} icon="bluetooth" onPress={() => connectDevice(lastAdapter)}>Conectar ultimo scanner</AppButton>
        </Panel>
      ) : null}

      {connectionReady && activeAdapter ? (
        <Panel subtitle="Conexão validada. O painel já pode ler os sensores em tempo real." title="Scanner conectado">
          <Text style={styles.value}>{activeAdapter.name}</Text>
          <Text style={styles.muted}>{activeAdapter.address}</Text>
        </Panel>
      ) : (
        <Panel subtitle="1. Busque proximos. 2. Pareie o OBDII. 3. Toque nele em pareados para conectar e validar." title="Conectar scanner">
          <ConnectionGauge active={loading} label={connectingDeviceId ? 'Validando resposta do adaptador...' : 'Buscando dispositivos pareados...'} />
          <Text style={styles.muted}>{status}</Text>
          <AppButton disabled={loading} icon="search" onPress={discoverDevices}>Buscar novos</AppButton>
          <AppButton disabled={loading} icon="refresh" onPress={loadDevices} tone="secondary">Atualizar pareados</AppButton>
          <AppButton disabled={loading} icon="send" onPress={shareDiagnosticReport} tone="secondary">Compartilhar relatório</AppButton>
          {availableDevices.length ? (
            <View style={styles.group}>
              <Text style={styles.sectionLabel}>Disponiveis para parear</Text>
              {availableDevices.map((device) => (
                <DeviceCard
                  actionLabel="Toque para parear"
                  device={device}
                  key={device.id}
                  onPress={() => pairDevice(device)}
                  working={connectingDeviceId === device.id}
                  workingLabel="Pareando..."
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.sectionLabel}>Pareados</Text>
          {devices.map((device) => (
            <DeviceCard
              actionLabel={isLikelyObdDevice(device) ? 'Candidato OBD2' : 'Bluetooth pareado'}
              active={activeAdapter?.id === device.id}
              device={device}
              key={device.id}
              onPress={() => connectDevice(device)}
              working={connectingDeviceId === device.id}
              workingLabel="Conectando..."
            />
          ))}
        </Panel>
      )}

      <Panel title="Console de conexão">
        {consoleLines.length ? consoleLines.slice(-80).map((line, index) => (
          <Text key={`${line}-${index}`} selectable style={styles.consoleLine}>{line}</Text>
        )) : <Text style={styles.muted}>Nenhuma tentativa registrada.</Text>}
      </Panel>
    </Screen>
  );

  function appendConsole(line: string) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setConsoleLines((current) => [...current.slice(-119), `[${timestamp}] ${line}`]);
  }
}

function bluetoothErrorMessage(error: unknown) {
  const message = errorMessage(error);

  if (message.includes('BLUETOOTH_CONNECT') || message.includes('Permission')) {
    return 'Permissão Bluetooth pendente. Volte para a tela inicial e toque em Preparar permissões.';
  }

  return message || 'Falha ao listar dispositivos pareados.';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? '');
}

function sortObdCandidates(devices: BluetoothDeviceInfo[]) {
  return [...devices].sort((a, b) => Number(isLikelyObdDevice(b)) - Number(isLikelyObdDevice(a)));
}

function isLikelyObdDevice(device: BluetoothDeviceInfo) {
  const name = device.name.toLowerCase();
  return name.includes('sp') || name.includes('obd') || name.includes('elm');
}

function DeviceCard({
  actionLabel,
  active,
  device,
  onPress,
  working,
  workingLabel,
}: {
  actionLabel: string;
  active?: boolean;
  device: BluetoothDeviceInfo;
  onPress: () => void;
  working?: boolean;
  workingLabel?: string;
}) {
  const likelyObd = isLikelyObdDevice(device);
  const footerLabel = working ? workingLabel ?? 'Conectando...' : active ? 'Conectado' : actionLabel;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.device,
        likelyObd && styles.obdCandidate,
        active && styles.selectedDevice,
        working && styles.workingDevice,
        pressed && styles.pressedDevice,
      ]}
    >
      <View pointerEvents="none" style={[styles.deviceGlow, likelyObd && styles.obdCandidateGlow, working && styles.workingGlow]} />
      <View style={styles.deviceHeader}>
        <View style={styles.deviceText}>
          <Text style={[styles.value, likelyObd && styles.obdCandidateValue]}>{device.name}</Text>
          <Text style={styles.muted}>{device.address}</Text>
        </View>
        {active ? <Text style={styles.connectedBadge}>OK</Text> : null}
        {working ? <Text style={styles.workingBadge}>...</Text> : null}
        {likelyObd && !active && !working ? <Text style={styles.candidateBadge}>OBD2</Text> : null}
      </View>
      <Text style={[styles.hint, likelyObd && styles.obdCandidateHint, active && styles.connectedHint, working && styles.workingHint]}>{footerLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  candidateBadge: {
    backgroundColor: 'rgba(94,234,212,0.16)',
    borderColor: colors.primaryGlow,
    borderRadius: 4,
    borderWidth: 1,
    color: colors.primaryGlow,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectedBadge: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: colors.success,
    borderRadius: 4,
    borderWidth: 1,
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectedHint: {
    color: colors.success,
  },
  device: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.md,
  },
  deviceGlow: {
    backgroundColor: colors.electric,
    height: 96,
    opacity: 0,
    position: 'absolute',
    right: -42,
    top: -34,
    transform: [{ rotate: '-18deg' }],
    width: 96,
  },
  deviceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  deviceText: {
    flex: 1,
  },
  consoleLine: {
    color: colors.muted,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 17,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  hint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  obdCandidate: {
    backgroundColor: '#102238',
    borderColor: colors.primaryGlow,
    shadowColor: colors.primaryGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  obdCandidateGlow: {
    opacity: 0.18,
  },
  obdCandidateHint: {
    color: colors.primaryGlow,
  },
  obdCandidateValue: {
    color: colors.white,
    textShadowColor: colors.primaryGlow,
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 8,
  },
  pressedDevice: {
    backgroundColor: '#16324c',
    borderColor: colors.electric,
    transform: [{ scale: 0.985 }],
  },
  selectedDevice: {
    backgroundColor: '#102a25',
    borderColor: colors.success,
  },
  workingBadge: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: colors.warning,
    borderRadius: 4,
    borderWidth: 1,
    color: colors.warning,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  workingDevice: {
    backgroundColor: '#2c2415',
    borderColor: colors.warning,
  },
  workingGlow: {
    backgroundColor: colors.warning,
    opacity: 0.2,
  },
  workingHint: {
    color: colors.warning,
  },
  group: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
