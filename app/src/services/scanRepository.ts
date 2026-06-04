import { assertSupabaseConfigured, supabase } from '../lib/supabase/client';
import type { DtcCode, ObdReading, ScanSessionSummary, Vehicle, VehicleFingerprint } from '../types/domain';

export async function fetchVehicles() {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Vehicle[];
}

export async function createVehicle(vehicle: Omit<Vehicle, 'id' | 'user_id'>) {
  assertSupabaseConfigured();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...vehicle, user_id: userId })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as Vehicle;
}

export async function createScanSession(vehicleId: string, adapterName?: string, adapterAddress?: string) {
  assertSupabaseConfigured();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('scan_sessions')
    .insert({
      adapter_address: adapterAddress,
      adapter_name: adapterName,
      started_at: new Date().toISOString(),
      status: 'open',
      user_id: userId,
      vehicle_id: vehicleId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

export async function finishScanSession(sessionId: string, status: 'finished' | 'failed' = 'finished') {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from('scan_sessions')
    .update({
      ended_at: new Date().toISOString(),
      status,
    })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

export async function fetchScanHistory() {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('scan_sessions')
    .select(`
      *,
      vehicles(make, model, year, plate),
      live_readings(id, name, value, unit, recorded_at),
      dtc_codes(id, code, description, status)
    `)
    .order('started_at', { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  return (data ?? []) as ScanSessionSummary[];
}

export async function saveReadings(sessionId: string, readings: ObdReading[]) {
  if (!readings.length) {
    return;
  }

  assertSupabaseConfigured();
  const userId = await getUserId();

  const { error } = await supabase.from('live_readings').insert(
    readings.map((reading) => ({
      name: reading.name,
      pid: reading.pid,
      raw_response: reading.rawResponse,
      session_id: sessionId,
      unit: reading.unit,
      user_id: userId,
      value: reading.value,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function saveDtcs(sessionId: string, dtcs: DtcCode[]) {
  if (!dtcs.length) {
    return;
  }

  assertSupabaseConfigured();
  const userId = await getUserId();

  const { error } = await supabase.from('dtc_codes').insert(
    dtcs.map((dtc) => ({
      code: dtc.code,
      description: dtc.description,
      raw_response: dtc.rawResponse,
      session_id: sessionId,
      status: dtc.status,
      user_id: userId,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function saveVehicleFingerprint(
  vehicleId: string,
  sessionId: string,
  fingerprint: VehicleFingerprint,
) {
  assertSupabaseConfigured();
  const userId = await getUserId();

  const { error } = await supabase.from('vehicle_fingerprints').insert({
    calibration_ids: fingerprint.calibrationIds,
    confidence: fingerprint.confidence,
    cvns: fingerprint.cvns,
    ecu_names: fingerprint.ecuNames,
    likely_make: fingerprint.likelyMake,
    likely_model: fingerprint.likelyModel,
    likely_year: fingerprint.likelyYear,
    protocol: fingerprint.protocol,
    raw_data: fingerprint.raw,
    session_id: sessionId,
    supported_pids_01: fingerprint.supportedPids01,
    supported_pids_21: fingerprint.supportedPids21,
    user_id: userId,
    vehicle_id: vehicleId,
    vin: fingerprint.vin,
  });

  if (error) {
    throw error;
  }
}

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw error ?? new Error('Usuario nao autenticado.');
  }

  return data.user.id;
}
