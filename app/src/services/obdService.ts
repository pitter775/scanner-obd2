import { parseDtcResponse } from '../lib/obd/dtc';
import { buildFingerprint } from '../lib/obd/fingerprint';
import { obdPids, parsePidResponse } from '../lib/obd/pids';
import type { DtcCode, ObdReading, VehicleFingerprint } from '../types/domain';
import { BluetoothConnection } from './bluetoothService';

const initCommands = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0', '0100'];

export class ObdService {
  constructor(
    private readonly connection: BluetoothConnection,
    private readonly onLog?: (line: string) => void,
  ) {}

  async initialize() {
    const responses: string[] = [];

    for (const command of initCommands) {
      responses.push(await this.sendCommand(command));
    }

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

  async readLiveData(): Promise<ObdReading[]> {
    const readings: ObdReading[] = [];

    for (const pid of obdPids) {
      const raw = await this.sendCommand(pid.pid);
      const parsed = parsePidResponse(pid.pid, raw);

      if (parsed) {
        readings.push(parsed);
      }
    }

    return readings;
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

  private async sendCommand(command: string) {
    this.onLog?.(`> ${command}`);
    await this.connection.send(command);
    await delay(250);
    const response = await this.connection.read();
    this.onLog?.(`< ${response.trim() || 'sem resposta'}`);
    return response;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
