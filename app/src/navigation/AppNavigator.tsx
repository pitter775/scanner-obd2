import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../config/theme';
import { AccountScreen } from '../screens/AccountScreen';
import { BluetoothScreen } from '../screens/BluetoothScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DebugScreen } from '../screens/DebugScreen';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { VehiclesScreen } from '../screens/VehiclesScreen';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: 16, fontWeight: '800' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen component={LoginScreen} name="Login" options={{ title: 'Entrar' }} />
      <Stack.Screen component={HomeScreen} name="Home" options={{ title: 'Scanner OBD2' }} />
      <Stack.Screen component={VehiclesScreen} name="Vehicles" options={{ title: 'Veiculos' }} />
      <Stack.Screen component={BluetoothScreen} name="Bluetooth" options={{ title: 'Bluetooth' }} />
      <Stack.Screen component={DashboardScreen} name="Dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen component={DiagnosticsScreen} name="Diagnostics" options={{ title: 'Falhas DTC' }} />
      <Stack.Screen component={HistoryScreen} name="History" options={{ title: 'Historico' }} />
      <Stack.Screen component={DebugScreen} name="Debug" options={{ title: 'Debug' }} />
      <Stack.Screen component={AccountScreen} name="Account" options={{ title: 'Conta' }} />
    </Stack.Navigator>
  );
}
