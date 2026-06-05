import type { BluetoothDeviceInfo, Vehicle } from './domain';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Bluetooth: undefined;
  Dashboard: { vehicle?: Vehicle; adapter?: BluetoothDeviceInfo } | undefined;
  Diagnostics: undefined;
  History: undefined;
  TripMap: { tripId: string };
  TripCompare: { baseTripId?: string; compareTripId?: string } | undefined;
  Debug: undefined;
  Account: undefined;
};
