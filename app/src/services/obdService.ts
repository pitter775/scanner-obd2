import { parseDtcResponse } from '../lib/obd/dtc';
import { buildFingerprint } from '../lib/obd/fingerprint';
import { obdPids, parsePidResponse, realtimeFastPids, realtimeSlowPids, type ObdPid } from '../lib/obd/pids';
import type { DtcCode, ObdReading, VehicleFingerprint } from '../types/domain';
import { BluetoothConnection, normalizeElmResponse, sendElmCommand } from './bluetoothService';

const initCommands = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

export class ObdService {
  constructor(
    private readonly connection: BluetoothConnection,
    private readonly onLog?: (line: string) => void,
  ) {}

  async initialize() {
    const responses: string[] = [];

    for (const command of initCommands) {
      responses.push(await this.sendCommand(command, command === 'ATZ' ? 8000 : 5000));
    }

    responses.push(await this.sendCommand('0100', 10000));

    return responses;
  }

  async readSupportedPids() {
    return this.sendCommand('0100');
  }

  async identifyVehicle(): Promise<VehicleFingerprint> {
    return buildFingerprint({
      calibrationId: await this.sendCommand('0904'),
      cvn: await this.sendCommand('0906'),
      ecuName: await this.sendCommand('090A'),
      protocol: await this.sendCommand('ATDPN'),
      supportedPids01: await this.sendCommand('0100'),
      supportedPids21: await this.sendCommand('0120'),
      vin: await this.sendCommand('0902'),
    });
  }

  async readLiveData(onReading?: (reading: ObdReading) => void): Promise<ObdReading[]> {
    return this.readPidGroup(obdPids, onReading, 2600);
  }

  async readRealtimeFrame(frameIndex: number, onReading?: (reading: ObdReading) => void): Promise<ObdReading[]> {
    const pids = frameIndex % 4 === 0 ? [...realtimeFastPids, ...realtimeSlowPids] : realtimeFastPids;
    return this.readPidGroup(pids, onReading, 1400);
  }

  private async readPidGroup(pids: ObdPid[], onReading: ((reading: ObdReading) => void) | undefined, timeoutMs: number) {
    const readings: ObdReading[] = [];

    for (const pid of pids) {
      const raw = await this.sendCommand(pid.pid, timeoutMs, { idleMs: 120, pollMs: 35 });
      const parsed = parsePidResponse(pid.pid, raw);

      if (parsed) {
        readings.push(parsed);
        onReading?.(parsed);
      }
    }

    return readings;
  }

  async readRawSnapshot() {
    const commands = ['0100', '0120', '0140', '0160', ...obdPids.map((pid) => pid.pid), '03', '07', '0A', '0902', '0904', '0906', '090A', 'ATDPN'];
    const responses: string[] = [];

    for (const command of [...new Set(commands)]) {
      try {
        responses.push(`${command}: ${await this.sendCommand(command, 8000) || 'sem resposta'}`);
      } catch (error) {
        responses.push(`${command}: ERRO ${error instanceof Error ? error.message : String(error ?? '')}`);
      }
    }

    return responses;
  }

  async readDtcs(): Promise<DtcCode[]> {
    const stored = parseDtcResponse(await this.sendCommand('03'), 'stored');
    const pending = parseDtcResponse(await this.sendCommand('07'), 'pending');
    const permanent = parseDtcResponse(await this.sendCommand('0A'), 'permanent');

    return [...stored, ...pending, ...permanent];
  }

  async clearDtcs() {
    return this.sendCommand('04');
  }

  private async sendCommand(command: string, timeoutMs = 6000, options: { idleMs?: number; pollMs?: number } = {}) {
    this.onLog?.(`> ${command}`);
    const response = normalizeElmResponse(await sendElmCommand(this.connection, command, { ...options, timeoutMs }));
    this.onLog?.(`< ${response || 'sem resposta'}`);
    return response;
  }
}
