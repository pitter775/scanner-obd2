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
        <Info label="Veiculo" value={activeVehicle ? `${activeVehicle.make} ${activeVehicle.model} ${activeVehicle.year}` : 'Nenhum selecionado'} />
        <Info label="Adaptador" value={connectionReady && activeAdapter ? `${activeAdapter.name} conectado` : 'Conecte o adaptador OBD2 primeiro'} />
      </Panel>

      <Panel title="Acoes">
        <AppButton onPress={() => navigation.navigate('Bluetooth')}>Conectar adaptador OBD2</AppButton>
        <AppButton disabled={!connectionReady} onPress={() => navigation.navigate('Dashboard')} tone="secondary">Iniciar diagnostico</AppButton>
        <AppButton disabled={!connectionReady} onPress={() => navigation.navigate('Diagnostics')} tone="secondary">Codigos de falha</AppButton>
        <AppButton disabled={!connectionReady} onPress={() => navigation.navigate('Vehicles')} tone="secondary">Veiculos</AppButton>
        <AppButton disabled={!connectionReady} onPress={() => navigation.navigate('Debug')} tone="secondary">Debug</AppButton>
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
