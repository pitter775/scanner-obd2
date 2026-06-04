import { create } from 'zustand';

import type { BluetoothDeviceInfo, DtcCode, ObdReading, Vehicle, VehicleFingerprint } from '../types/domain';

type AppState = {
  activeAdapter?: BluetoothDeviceInfo;
  activeVehicle?: Vehicle;
  communicationLog: string[];
  dtcs: DtcCode[];
  fingerprint?: VehicleFingerprint;
  readings: ObdReading[];
  appendCommunicationLog: (line: string) => void;
  clearCommunicationLog: () => void;
  setActiveAdapter: (adapter?: BluetoothDeviceInfo) => void;
  setActiveVehicle: (vehicle?: Vehicle) => void;
  setDtcs: (dtcs: DtcCode[]) => void;
  setFingerprint: (fingerprint?: VehicleFingerprint) => void;
  setReadings: (readings: ObdReading[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  communicationLog: [],
  dtcs: [],
  readings: [],
  appendCommunicationLog: (line) => set((state) => ({
    communicationLog: [...state.communicationLog.slice(-79), line],
  })),
  clearCommunicationLog: () => set({ communicationLog: [] }),
  setActiveAdapter: (activeAdapter) => set({ activeAdapter }),
  setActiveVehicle: (activeVehicle) => set({ activeVehicle }),
  setDtcs: (dtcs) => set({ dtcs }),
  setFingerprint: (fingerprint) => set({ fingerprint }),
  setReadings: (readings) => set({ readings }),
}));
