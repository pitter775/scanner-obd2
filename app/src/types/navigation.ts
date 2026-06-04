import type { BluetoothDeviceInfo, Vehicle } from './domain';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Vehicles: undefined;
  Bluetooth: undefined;
  Dashboard: { vehicle?: Vehicle; adapter?: BluetoothDeviceInfo } | undefined;
  Diagnostics: undefined;
  History: undefined;
  Account: undefined;
};
