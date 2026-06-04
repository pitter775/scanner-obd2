import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { isSupabaseConfigured } from '../config/env';
import { BluetoothConnection } from '../services/bluetoothService';
import { ObdService } from '../services/obdService';
import { createScanSession, saveDtcs } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { DtcCode } from '../types/domain';

export function DiagnosticsScreen() {
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const dtcs = useAppStore((state) => state.dtcs);
  const setDtcs = useAppStore((state) => state.setDtcs);
  const [loading, setLoading] = useState(false);

  async function readDtcs() {
    if (!activeVehicle || !activeAdapter) {
      Alert.alert('DTC', 'Selecione um veiculo e um adaptador Bluetooth.');
      return;
    }

    setLoading(true);
    const connection = new BluetoothConnection();

    try {
      await connection.connect(activeAdapter.address);
      const obd = new ObdService(connection);
      await obd.initialize();
      const nextDtcs = await obd.readDtcs();
      setDtcs(nextDtcs);

      if (isSupabaseConfigured) {
        const session = await createScanSession(activeVehicle.id, activeAdapter.name, activeAdapter.address);
        await saveDtcs(session.id, nextDtcs);
      }
    } catch (error) {
      Alert.alert('DTC', error instanceof Error ? error.message : 'Falha ao ler falhas.');
    } finally {
      await connection.disconnect();
      setLoading(false);
    }
  }

  function confirmClearDtcs() {
    Alert.alert(
      'Apagar falhas',
      'Apagar DTCs nao corrige a causa do problema. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: clearDtcs },
      ],
    );
  }

  async function clearDtcs() {
    if (!activeAdapter) {
      Alert.alert('DTC', 'Selecione um adaptador Bluetooth.');
      return;
    }

    setLoading(true);
    const connection = new BluetoothConnection();

    try {
      await connection.connect(activeAdapter.address);
      const obd = new ObdService(connection);
      await obd.initialize();
      await obd.clearDtcs();
      setDtcs([]);
      Alert.alert('DTC', 'Comando de apagar falhas enviado.');
    } catch (error) {
      Alert.alert('DTC', error instanceof Error ? error.message : 'Falha ao apagar falhas.');
    } finally {
      await connection.disconnect();
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Panel title="Codigos de falha">
        <AppButton disabled={loading} onPress={readDtcs}>Ler DTCs</AppButton>
        <AppButton disabled={loading} onPress={confirmClearDtcs} tone="danger">Apagar falhas</AppButton>
      </Panel>

      {dtcs.length ? dtcs.map((dtc) => <DtcCard dtc={dtc} key={`${dtc.status}-${dtc.code}`} />) : (
        <Text style={styles.muted}>Nenhum codigo carregado.</Text>
      )}
    </Screen>
  );
}

function DtcCard({ dtc }: { dtc: DtcCode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.code}>{dtc.code}</Text>
      <Text style={styles.status}>{statusLabel[dtc.status]}</Text>
      <Text style={styles.description}>{dtc.description}</Text>
    </View>
  );
}

const statusLabel: Record<DtcCode['status'], string> = {
  pending: 'Pendente',
  permanent: 'Permanente',
  stored: 'Ativo/armazenado',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  code: {
    color: colors.warning,
    fontSize: 24,
    fontWeight: '900',
  },
  description: {
    color: colors.text,
    fontSize: 15,
  },
  muted: {
    color: colors.muted,
  },
  status: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
