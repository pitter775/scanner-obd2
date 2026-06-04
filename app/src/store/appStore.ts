import { create } from 'zustand';

import type { BluetoothDeviceInfo, DtcCode, ObdReading, Vehicle, VehicleFingerprint } from '../types/domain';

export type DiagnosticEvent = {
  id: string;
  at: string;
  level: 'error' | 'info' | 'warn';
  message: string;
  details?: string;
};

type AppState = {
  activeAdapter?: BluetoothDeviceInfo;
  activeVehicle?: Vehicle;
  communicationLog: string[];
  connectionReady: boolean;
  diagnosticEvents: DiagnosticEvent[];
  dtcs: DtcCode[];
  fingerprint?: VehicleFingerprint;
  readings: ObdReading[];
  appendCommunicationLog: (line: string) => void;
  appendDiagnosticEvent: (event: Omit<DiagnosticEvent, 'id' | 'at'> & Partial<Pick<DiagnosticEvent, 'at' | 'id'>>) => void;
  clearCommunicationLog: () => void;
  clearDiagnosticEvents: () => void;
  setActiveAdapter: (adapter?: BluetoothDeviceInfo) => void;
  setActiveVehicle: (vehicle?: Vehicle) => void;
  setConnectionReady: (ready: boolean) => void;
  setDtcs: (dtcs: DtcCode[]) => void;
  setFingerprint: (fingerprint?: VehicleFingerprint) => void;
  setReadings: (readings: ObdReading[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  communicationLog: [],
  connectionReady: false,
  diagnosticEvents: [],
  dtcs: [],
  readings: [],
  appendCommunicationLog: (line) => set((state) => ({
    communicationLog: [...state.communicationLog.slice(-79), line],
  })),
  appendDiagnosticEvent: (event) => set((state) => ({
    diagnosticEvents: [
      ...state.diagnosticEvents.slice(-119),
      {
        at: event.at ?? new Date().toISOString(),
        id: event.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        level: event.level,
        message: event.message,
        details: event.details,
      },
    ],
  })),
  clearCommunicationLog: () => set({ communicationLog: [] }),
  clearDiagnosticEvents: () => set({ diagnosticEvents: [] }),
  setActiveAdapter: (activeAdapter) => set({ activeAdapter }),
  setActiveVehicle: (activeVehicle) => set({ activeVehicle }),
  setConnectionReady: (connectionReady) => set({ connectionReady }),
  setDtcs: (dtcs) => set({ dtcs }),
  setFingerprint: (fingerprint) => set({ fingerprint }),
  setReadings: (readings) => set({ readings }),
}));
