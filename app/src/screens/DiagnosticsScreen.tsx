import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../config/theme';
import { isCloudSyncEnabled } from '../config/env';
import { getSharedConnection, obdBluetoothErrorMessage } from '../services/bluetoothService';
import { recordDiagnosticEvent } from '../services/diagnosticLog';
import { ObdService } from '../services/obdService';
import { createScanSession, finishScanSession, saveDtcs } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { DtcCode } from '../types/domain';

export function DiagnosticsScreen() {
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const dtcs = useAppStore((state) => state.dtcs);
  const setActiveVehicle = useAppStore((state) => state.setActiveVehicle);
  const setDtcs = useAppStore((state) => state.setDtcs);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  async function readDtcs() {
    const vehicle = activeVehicle ?? defaultVehicle;
    if (!activeVehicle) {
      setActiveVehicle(vehicle);
    }

    if (!activeAdapter) {
      setStatusMessage('Conecte o SP359 na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setStatusMessage('');

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      const obd = new ObdService(connection);
      await obd.initialize();
      const nextDtcs = await obd.readDtcs();
      setDtcs(nextDtcs);

      if (isCloudSyncEnabled) {
        const session = await createScanSession(vehicle.id, activeAdapter.name, activeAdapter.address);
        await saveDtcs(session.id, nextDtcs);
        await finishScanSession(session.id);
      }
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha ao ler DTCs', error);
      setStatusMessage(obdBluetoothErrorMessage(error));
    } finally {
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
      setStatusMessage('Conecte o SP359 na tela Bluetooth primeiro.');
      return;
    }

    setLoading(true);
    setStatusMessage('');

    try {
      const connection = await getSharedConnection(activeAdapter.address);
      const obd = new ObdService(connection);
      await obd.initialize();
      await obd.clearDtcs();
      setDtcs([]);
      setStatusMessage('Comando de apagar falhas enviado.');
    } catch (error) {
      recordDiagnosticEvent('error', 'Falha ao apagar DTCs', error);
      setStatusMessage(obdBluetoothErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Panel title="Codigos de falha">
        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        <AppButton disabled={loading} onPress={readDtcs}>Ler DTCs</AppButton>
        <AppButton disabled={loading} onPress={confirmClearDtcs} tone="danger">Apagar falhas</AppButton>
      </Panel>

      {dtcs.length ? dtcs.map((dtc) => <DtcCard dtc={dtc} key={`${dtc.status}-${dtc.code}`} />) : (
        <Text style={styles.muted}>Nenhum codigo carregado.</Text>
      )}
    </Screen>
  );
}

const defaultVehicle = {
  id: 'local-focus-2006',
  make: 'Ford',
  model: 'Focus',
  user_id: 'local',
  year: 2006,
};

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
  status: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
