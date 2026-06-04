import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../config/theme';
import { isCloudSyncEnabled } from '../config/env';
import { createVehicle } from '../services/scanRepository';
import { useAppStore } from '../store/appStore';
import type { Vehicle } from '../types/domain';

export function VehiclesScreen() {
  const activeVehicle = useAppStore((state) => state.activeVehicle);
  const setActiveVehicle = useAppStore((state) => state.setActiveVehicle);
  const [make, setMake] = useState('Ford');
  const [model, setModel] = useState('Focus');
  const [year, setYear] = useState('2006');
  const [engine, setEngine] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);

  async function saveVehicle() {
    const payload = {
      engine,
      make,
      model,
      notes: null,
      plate,
      vin: null,
      year: Number(year),
    };

    if (!payload.make || !payload.model || !payload.year) {
      Alert.alert('Veiculo', 'Informe marca, modelo e ano.');
      return;
    }

    if (!isCloudSyncEnabled) {
      setActiveVehicle({
        ...payload,
        id: `local-${Date.now()}`,
        user_id: 'local',
      });
      return;
    }

    setLoading(true);
    try {
      const vehicle = await createVehicle(payload);
      setActiveVehicle(vehicle);
    } catch (error) {
      Alert.alert('Veiculo', 'Veiculo selecionado localmente para teste.');
      setActiveVehicle({
        ...payload,
        id: `local-${Date.now()}`,
        user_id: 'local',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Panel title="Veiculo ativo">
        {activeVehicle ? <VehicleSummary vehicle={activeVehicle} /> : <Text style={styles.muted}>Nenhum veiculo selecionado.</Text>}
      </Panel>

      <Panel subtitle="Base inicial ja vem com Ford Focus 2006 para teste." title="Cadastrar veiculo">
        <TextField label="Marca" onChangeText={setMake} value={make} />
        <TextField label="Modelo" onChangeText={setModel} value={model} />
        <TextField keyboardType="number-pad" label="Ano" onChangeText={setYear} value={year} />
        <TextField label="Motor" onChangeText={setEngine} placeholder="ex: 1.6, 2.0" value={engine} />
        <TextField autoCapitalize="characters" label="Placa" onChangeText={setPlate} value={plate} />
        <AppButton disabled={loading} onPress={saveVehicle}>Salvar e selecionar</AppButton>
      </Panel>
    </Screen>
  );
}

function VehicleSummary({ vehicle }: { vehicle: Vehicle }) {
  return (
    <View>
      <Text style={styles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
      <Text style={styles.muted}>{vehicle.year} {vehicle.engine ? `- ${vehicle.engine}` : ''}</Text>
      {vehicle.plate ? <Text style={styles.muted}>Placa: {vehicle.plate}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
  vehicleName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
});
