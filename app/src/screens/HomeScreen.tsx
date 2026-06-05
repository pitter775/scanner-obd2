import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors } from '../config/theme';
import { useAppStore } from '../store/appStore';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const activeAdapter = useAppStore((state) => state.activeAdapter);
  const connectionReady = useAppStore((state) => state.connectionReady);

  return (
    <Screen>
      <Panel title="Status">
        <Info label="Veículo" value={activeVehicle ? `${activeVehicle.make} ${activeVehicle.model} ${activeVehicle.year}` : 'Nenhum selecionado'} />
        <Info label="Adaptador" value={connectionReady && activeAdapter ? `${activeAdapter.name} conectado` : 'Conecte o adaptador OBD2 primeiro'} />
      </Panel>

      <Panel title="Ações">
        <AppButton icon="bluetooth" onPress={() => navigation.navigate('Bluetooth')}>Conectar adaptador OBD2</AppButton>
        <AppButton disabled={!connectionReady} icon="gauge" onPress={() => navigation.navigate('Dashboard')} tone="secondary">Iniciar diagnóstico</AppButton>
        <AppButton disabled={!connectionReady} icon="shield-alert" onPress={() => navigation.navigate('Diagnostics')} tone="secondary">Códigos de falha</AppButton>
        <AppButton icon="chart" onPress={() => navigation.navigate('History')} tone="secondary">Historico e voltas</AppButton>
        <AppButton disabled={!connectionReady} icon="bug" onPress={() => navigation.navigate('Debug')} tone="secondary">Debug</AppButton>
      </Panel>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    gap: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
