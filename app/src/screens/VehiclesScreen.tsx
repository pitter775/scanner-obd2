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
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
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

      <Panel subtitle="Preencha manualmente ou use Identificar veiculo no Dashboard para tentar ler o VIN/chassi pela ECU." title="Cadastrar veiculo">
        <TextField label="Marca" onChangeText={setMake} placeholder="ex: Ford" value={make} />
        <TextField label="Modelo" onChangeText={setModel} placeholder="ex: Focus" value={model} />
        <TextField keyboardType="number-pad" label="Ano" onChangeText={setYear} placeholder="ex: 2006" value={year} />
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
