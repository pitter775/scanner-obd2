import { create } from 'zustand';

import {
  createLocalTrip,
  createLocalTripPoint,
  fetchLocalTripSummaries,
  fetchLocalTrips,
  persistLocalTrips,
} from '../services/localTripRepository';
import type { BluetoothDeviceInfo, DtcCode, LocalTrip, LocalTripSummary, ObdReading, Vehicle, VehicleFingerprint } from '../types/domain';

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
  localTripSummaries: LocalTripSummary[];
  localTrips: LocalTrip[];
  mockMode: boolean;
  obdRawResponses: string[];
  readings: ObdReading[];
  recordingTrip?: LocalTrip;
  appendCommunicationLog: (line: string) => void;
  appendDiagnosticEvent: (event: Omit<DiagnosticEvent, 'id' | 'at'> & Partial<Pick<DiagnosticEvent, 'at' | 'id'>>) => void;
  appendObdRawResponse: (line: string) => void;
  clearCommunicationLog: () => void;
  clearDiagnosticEvents: () => void;
  clearObdRawResponses: () => void;
  setActiveAdapter: (adapter?: BluetoothDeviceInfo) => void;
  setActiveVehicle: (vehicle?: Vehicle) => void;
  setConnectionReady: (ready: boolean) => void;
  setDtcs: (dtcs: DtcCode[]) => void;
  setFingerprint: (fingerprint?: VehicleFingerprint) => void;
  loadLocalTrips: () => Promise<void>;
  recordTripFrame: (readings: ObdReading[], coordinates?: { latitude: number; longitude: number } | null) => Promise<void>;
  setMockMode: (enabled: boolean) => void;
  setReadings: (readings: ObdReading[]) => void;
  startLocalTrip: (metadata?: { name?: string; notes?: string | null }) => Promise<void>;
  stopLocalTrip: () => Promise<void>;
};

export const useAppStore = create<AppState>((set) => ({
  communicationLog: [],
  connectionReady: false,
  diagnosticEvents: [],
  dtcs: [],
  localTripSummaries: [],
  localTrips: [],
  mockMode: false,
  obdRawResponses: [],
  readings: [],
  appendCommunicationLog: (line) => set((state) => ({
    communicationLog: [...state.communicationLog.slice(-499), line],
  })),
  appendDiagnosticEvent: (event) => set((state) => ({
    diagnosticEvents: [
      ...state.diagnosticEvents.slice(-499),
      {
        at: event.at ?? new Date().toISOString(),
        id: event.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        level: event.level,
        message: event.message,
        details: event.details,
      },
    ],
  })),
  appendObdRawResponse: (line) => set((state) => ({
    obdRawResponses: [...state.obdRawResponses.slice(-499), line],
  })),
  clearCommunicationLog: () => set({ communicationLog: [] }),
  clearDiagnosticEvents: () => set({ diagnosticEvents: [] }),
  clearObdRawResponses: () => set({ obdRawResponses: [] }),
  setActiveAdapter: (activeAdapter) => set({ activeAdapter }),
  setActiveVehicle: (activeVehicle) => set({ activeVehicle }),
  setConnectionReady: (connectionReady) => set({ connectionReady }),
  setDtcs: (dtcs) => set({ dtcs }),
  setFingerprint: (fingerprint) => set({ fingerprint }),
  loadLocalTrips: async () => {
    const [localTrips, localTripSummaries] = await Promise.all([
      fetchLocalTrips(),
      fetchLocalTripSummaries(),
    ]);
    set({ localTripSummaries, localTrips });
  },
  recordTripFrame: async (readings, coordinates) => {
    const state = useAppStore.getState();
    const recordingTrip = state.recordingTrip;
    if (!recordingTrip) {
      return;
    }

    const lastPoint = recordingTrip.points[recordingTrip.points.length - 1];
    if (lastPoint && Date.now() - new Date(lastPoint.at).getTime() < 4000) {
      return;
    }

    const point = createLocalTripPoint(readings, coordinates);
    const nextTrip = {
      ...recordingTrip,
      points: [...recordingTrip.points.slice(-899), point],
    };
    set({ recordingTrip: nextTrip });
  },
  setMockMode: (mockMode) => set({ mockMode }),
  setReadings: (readings) => set({ readings }),
  startLocalTrip: async (metadata) => {
    const state = useAppStore.getState();
    if (state.recordingTrip) {
      return;
    }
    set({ recordingTrip: createLocalTrip(state.activeVehicle, state.activeAdapter, metadata) });
  },
  stopLocalTrip: async () => {
    const state = useAppStore.getState();
    const recordingTrip = state.recordingTrip;
    if (!recordingTrip) {
      return;
    }

    const finishedTrip = {
      ...recordingTrip,
      endedAt: new Date().toISOString(),
    };
    const persisted = await persistLocalTrips([finishedTrip, ...state.localTrips]);
    set({
      localTripSummaries: persisted.localTripSummaries,
      localTrips: persisted.localTrips,
      recordingTrip: undefined,
    });
  },
}));
