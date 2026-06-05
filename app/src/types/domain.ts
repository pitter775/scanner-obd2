export type Vehicle = {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  engine?: string | null;
  plate?: string | null;
  vin?: string | null;
  notes?: string | null;
};

export type ScanSession = {
  id: string;
  user_id: string;
  vehicle_id: string;
  adapter_name?: string | null;
  adapter_address?: string | null;
  obd_protocol?: string | null;
  battery_voltage?: number | null;
  status: 'open' | 'finished' | 'failed';
  started_at: string;
  ended_at?: string | null;
  created_at?: string;
};

export type ScanSessionSummary = ScanSession & {
  vehicles?: Pick<Vehicle, 'make' | 'model' | 'year' | 'plate'> | null;
  live_readings?: Array<{
    id: string;
    name: string;
    value: number;
    unit: string;
    recorded_at: string;
  }>;
  dtc_codes?: Array<{
    id: string;
    code: string;
    description?: string | null;
    status: string;
  }>;
};

export type LocalTripPoint = {
  id: string;
  at: string;
  latitude?: number | null;
  longitude?: number | null;
  speedKph?: number | null;
  rpm?: number | null;
  coolantTempC?: number | null;
  throttlePercent?: number | null;
  engineLoadPercent?: number | null;
  manifoldPressureKpa?: number | null;
  moduleVoltage?: number | null;
  engineEffort?: number | null;
  rawReadings: ObdReading[];
};

export type LocalTrip = {
  id: string;
  name: string;
  notes?: string | null;
  vehicle?: Pick<Vehicle, 'id' | 'make' | 'model' | 'year' | 'engine' | 'vin'> | null;
  adapterName?: string | null;
  adapterAddress?: string | null;
  startedAt: string;
  endedAt?: string | null;
  points: LocalTripPoint[];
};

export type LocalTripSummary = {
  id: string;
  name: string;
  notes?: string | null;
  vehicle?: LocalTrip['vehicle'];
  adapterName?: string | null;
  startedAt: string;
  endedAt?: string | null;
  pointCount: number;
  gpsPointCount: number;
  maxSpeedKph?: number | null;
  maxRpm?: number | null;
  maxCoolantTempC?: number | null;
  maxEngineLoadPercent?: number | null;
  maxManifoldPressureKpa?: number | null;
  maxThrottlePercent?: number | null;
  maxEngineEffort?: number | null;
  fullTripAvailable: boolean;
};

export type ObdReading = {
  pid: string;
  name: string;
  value: number;
  unit: string;
  rawResponse: string;
};

export type DtcCode = {
  code: string;
  description: string;
  status: 'stored' | 'pending' | 'permanent';
  rawResponse: string;
};

export type BluetoothDeviceInfo = {
  id: string;
  name: string;
  address: string;
};

export type VehicleFingerprint = {
  vin?: string | null;
  protocol?: string | null;
  supportedPids01?: string | null;
  supportedPids21?: string | null;
  calibrationIds: string[];
  cvns: string[];
  ecuNames: string[];
  likelyMake?: string | null;
  likelyModel?: string | null;
  likelyYear?: number | null;
  confidence: 'none' | 'low' | 'medium' | 'high';
  raw: Record<string, string>;
};
