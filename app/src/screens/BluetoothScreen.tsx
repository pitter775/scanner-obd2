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
  const [status, setStatus] = useState('Busque e conecte o SP359 antes de continuar.');

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
      setStatus(nextDevices.length ? 'Selecione o SP359 ou o adaptador OBD2 pareado.' : 'Nenhum dispositivo pareado encontrado.');
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
    appendConsole(`Pareando ${device.name} (${device.address})`);
    try {
      await pairBluetoothDevice(device.address);
      appendConsole('Pareado. Atualizando lista de pareados.');
      await loadDevices();
    } catch (error) {
      appendConsole(`Erro ao parear: ${errorMessage(error)}`);
      recordDiagnosticEvent('error', `Falha ao parear ${device.name}`, error);
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
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
      navigation.replace('Home');
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
      <Panel title="Adaptador ativo">
        <Text style={styles.value}>{activeAdapter?.name ?? 'Nenhum conectado'}</Text>
        {activeAdapter?.address ? <Text style={styles.muted}>{activeAdapter.address}</Text> : null}
        <Text style={connectionReady ? styles.ready : styles.muted}>
          {connectionReady ? 'Conexao validada' : status}
        </Text>
      </Panel>

      {lastAdapter ? (
        <Panel subtitle="Usa o ultimo scanner que funcionou, sem procurar de novo." title="Conexao rapida">
          <Text style={styles.value}>{lastAdapter.name}</Text>
          <Text style={styles.muted}>{lastAdapter.address}</Text>
          <AppButton disabled={loading} icon="▶" onPress={() => connectDevice(lastAdapter)}>Conectar ultimo scanner</AppButton>
        </Panel>
      ) : null}

      <Panel subtitle="1. Busque proximos. 2. Pareie o OBDII. 3. Toque nele em pareados para conectar e validar." title="Conectar scanner">
        <ConnectionGauge active={loading} label={connectingDeviceId ? 'Validando resposta do adaptador...' : 'Buscando dispositivos pareados...'} />
        <AppButton disabled={loading} icon="+" onPress={discoverDevices}>Buscar novos</AppButton>
        <AppButton disabled={loading} icon="↻" onPress={loadDevices} tone="secondary">Atualizar pareados</AppButton>
        <AppButton disabled={loading} icon="⇪" onPress={shareDiagnosticReport} tone="secondary">Compartilhar relatorio</AppButton>
        <AppButton disabled={loading} icon="i" onPress={() => navigation.navigate('Debug')} tone="secondary">Abrir debug</AppButton>
        {availableDevices.length ? (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>Disponiveis para parear</Text>
            {availableDevices.map((device) => (
              <Pressable key={device.id} onPress={() => pairDevice(device)} style={styles.device}>
                <View>
                  <Text style={styles.value}>{device.name}</Text>
                  <Text style={styles.muted}>{device.address}</Text>
                  <Text style={styles.hint}>Toque para parear</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.sectionLabel}>Pareados</Text>
        {devices.map((device) => (
          <Pressable key={device.id} onPress={() => connectDevice(device)} style={[styles.device, activeAdapter?.id === device.id && styles.selectedDevice]}>
            <View>
              <Text style={styles.value}>{device.name}</Text>
              <Text style={styles.muted}>{device.address}</Text>
              <Text style={styles.hint}>{isLikelyObdDevice(device) ? 'Candidato OBD2' : 'Bluetooth pareado'}</Text>
            </View>
          </Pressable>
        ))}
      </Panel>

      <Panel title="Console de conexao">
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
    return 'Permissao Bluetooth pendente. Volte para a tela inicial e toque em Preparar permissoes.';
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

const styles = StyleSheet.create({
  device: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
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
  ready: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  selectedDevice: {
    borderColor: colors.primary,
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
