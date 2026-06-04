import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { ConnectionGauge } from '../components/ConnectionGauge';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { listPairedDevices, obdBluetoothErrorMessage, testAdapterHandshake } from '../services/bluetoothService';
import { recordDiagnosticEvent } from '../services/diagnosticLog';
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
  const [loading, setLoading] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState('Busque e conecte o SP359 antes de continuar.');

  async function loadDevices() {
    setLoading(true);
    try {
      const nextDevices = await listPairedDevices();
      setDevices(sortObdCandidates(nextDevices));
      setStatus(nextDevices.length ? 'Selecione o SP359 ou o adaptador OBD2 pareado.' : 'Nenhum dispositivo pareado encontrado.');
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha ao listar dispositivos Bluetooth', error);
      setStatus(bluetoothErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function connectDevice(device: BluetoothDeviceInfo) {
    setLoading(true);
    setConnectingDeviceId(device.id);
    setConnectionReady(false);
    setStatus(`Conectando em ${device.name}...`);

    try {
      const response = await testAdapterHandshake(device.address);
      setActiveAdapter(device);
      setConnectionReady(true);
      setStatus(`${device.name} conectado. Resposta: ${response.slice(0, 40)}`);
      navigation.replace('Home');
    } catch (error) {
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

      <Panel subtitle="Pareie o SP359 nas configuracoes do Android antes de buscar. Depois selecione o SP359 aqui para validar a conexao." title="Dispositivos pareados">
        <ConnectionGauge active={loading} label={connectingDeviceId ? 'Validando resposta do adaptador...' : 'Buscando dispositivos pareados...'} />
        <AppButton disabled={loading} onPress={loadDevices}>Buscar dispositivos</AppButton>
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
    </Screen>
  );
}

function bluetoothErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('BLUETOOTH_CONNECT') || message.includes('Permission')) {
    return 'Permissao Bluetooth pendente. Volte para a tela inicial e toque em Preparar permissoes.';
  }

  return message || 'Falha ao listar dispositivos pareados.';
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
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
