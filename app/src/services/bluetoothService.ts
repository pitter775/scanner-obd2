import type { BluetoothDeviceInfo } from '../types/domain';

type ClassicDevice = {
  id?: string;
  name?: string;
  address?: string;
  connect?: () => Promise<ClassicDevice>;
  disconnect?: () => Promise<void>;
  write?: (data: string) => Promise<void>;
  read?: () => Promise<string>;
  isConnected?: () => Promise<boolean>;
};

type BluetoothModule = {
  getBondedDevices?: () => Promise<ClassicDevice[]>;
  requestBluetoothEnabled?: () => Promise<boolean>;
};

function getBluetoothModule(): BluetoothModule {
  const module = require('react-native-bluetooth-classic') as BluetoothModule & { default?: BluetoothModule };
  return module.default ?? module;
}

export async function listPairedDevices(): Promise<BluetoothDeviceInfo[]> {
  const bluetooth = getBluetoothModule();
  await bluetooth.requestBluetoothEnabled?.();
  const devices = await bluetooth.getBondedDevices?.();

  return (devices ?? []).map((device) => ({
    id: device.id ?? device.address ?? 'unknown',
    name: device.name ?? 'Dispositivo sem nome',
    address: device.address ?? device.id ?? '',
  }));
}

export class BluetoothConnection {
  private device?: ClassicDevice;

  async connect(address: string) {
    const devices = await getBluetoothModule().getBondedDevices?.();
    const selected = devices?.find((device) => device.address === address || device.id === address);

    if (!selected?.connect) {
      throw new Error('Dispositivo Bluetooth nao encontrado ou sem suporte a conexao.');
    }

    this.device = await selected.connect();
  }

  async disconnect() {
    await this.device?.disconnect?.();
    this.device = undefined;
  }

  async send(command: string) {
    if (!this.device?.write) {
      throw new Error('Scanner nao conectado.');
    }

    await this.device.write(`${command}\r`);
  }

  async read() {
    if (!this.device?.read) {
      throw new Error('Scanner nao conectado.');
    }

    return this.device.read();
  }

  async isConnected() {
    return Boolean(await this.device?.isConnected?.());
  }
}
