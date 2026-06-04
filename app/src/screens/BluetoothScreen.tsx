import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { listPairedDevices } from '../services/bluetoothService';
import { useAppStore } from '../store/appStore';
import type { BluetoothDeviceInfo } from '../types/domain';

export function BluetoothScreen() {
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const setActiveAdapter = useAppStore((state) => state.setActiveAdapter);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadDevices() {
    setLoading(true);
    try {
      setDevices(await listPairedDevices());
    } catch (error) {
      Alert.alert('Bluetooth', error instanceof Error ? error.message : 'Falha ao listar dispositivos pareados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Panel title="Adaptador ativo">
        <Text style={styles.value}>{activeAdapter?.name ?? 'Nenhum selecionado'}</Text>
        {activeAdapter?.address ? <Text style={styles.muted}>{activeAdapter.address}</Text> : null}
      </Panel>

      <Panel subtitle="Pareie o ELM327 nas configuracoes do Android antes de buscar." title="Dispositivos pareados">
        <AppButton disabled={loading} onPress={loadDevices}>Buscar dispositivos</AppButton>
        {devices.map((device) => (
          <Pressable key={device.id} onPress={() => setActiveAdapter(device)} style={styles.device}>
            <View>
              <Text style={styles.value}>{device.name}</Text>
              <Text style={styles.muted}>{device.address}</Text>
            </View>
          </Pressable>
        ))}
      </Panel>
    </Screen>
  );
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
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
