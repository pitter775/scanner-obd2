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
