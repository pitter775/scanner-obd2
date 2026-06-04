import { PermissionsAndroid, Platform } from 'react-native';

import type { BluetoothDeviceInfo } from '../types/domain';

type ClassicDevice = {
  id?: string;
  name?: string;
  address?: string;
  available?: () => Promise<number>;
  clear?: () => Promise<boolean>;
  connect?: (options?: BluetoothConnectionOptions) => Promise<boolean>;
  disconnect?: () => Promise<void>;
  write?: (data: string) => Promise<void>;
  read?: () => Promise<string>;
  isConnected?: () => Promise<boolean>;
};

type BluetoothConnectionOptions = {
  charset?: string;
  delimiter?: string;
  readSize?: number;
  secureSocket?: boolean;
};

type BluetoothModule = {
  getBondedDevices?: () => Promise<ClassicDevice[]>;
  requestBluetoothEnabled?: () => Promise<boolean>;
};

const elmConnectionOptions: BluetoothConnectionOptions = {
  charset: 'ascii',
  delimiter: '>',
  readSize: 1024,
  secureSocket: false,
};

let sharedConnection: BluetoothConnection | undefined;
let sharedAddress: string | undefined;

function getBluetoothModule(): BluetoothModule {
  const module = require('react-native-bluetooth-classic') as BluetoothModule & { default?: BluetoothModule };
  return module.default ?? module;
}

export async function listPairedDevices(): Promise<BluetoothDeviceInfo[]> {
  await ensureBluetoothPermissionsGranted();
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
    await ensureBluetoothPermissionsGranted();
    const devices = await getBluetoothModule().getBondedDevices?.();
    const selected = devices?.find((device) => device.address === address || device.id === address);

    if (!selected?.connect) {
      throw new Error('Dispositivo Bluetooth nao encontrado ou sem suporte a conexao.');
    }

    const connected = await selected.connect(elmConnectionOptions);

    if (!connected) {
      throw new Error('Nao foi possivel abrir o socket Bluetooth do adaptador.');
    }

    this.device = selected;
    await this.clear();
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

  async clear() {
    await this.device?.clear?.();
  }

  async read() {
    if (!this.device?.read) {
      throw new Error('Scanner nao conectado.');
    }

    return this.device.read();
  }

  async available() {
    return Number(await this.device?.available?.() ?? 0);
  }

  async isConnected() {
    return Boolean(await this.device?.isConnected?.());
  }
}

export async function connectSharedAdapter(address: string) {
  if (sharedConnection && sharedAddress === address && await sharedConnection.isConnected()) {
    return sharedConnection;
  }

  await disconnectSharedAdapter();
  const connection = new BluetoothConnection();
  await connection.connect(address);
  sharedConnection = connection;
  sharedAddress = address;
  return connection;
}

export async function disconnectSharedAdapter() {
  await sharedConnection?.disconnect();
  sharedConnection = undefined;
  sharedAddress = undefined;
}

export async function getSharedConnection(address: string) {
  if (sharedConnection && sharedAddress === address && await sharedConnection.isConnected()) {
    return sharedConnection;
  }

  return connectSharedAdapter(address);
}

export async function testAdapterHandshake(address: string) {
  const connection = await connectSharedAdapter(address);

  try {
    const resetResponse = await sendElmCommand(connection, 'ATZ', { settleMs: 1400, timeoutMs: 8000 });
    await sendElmCommand(connection, 'ATE0', { timeoutMs: 5000 });
    await sendElmCommand(connection, 'ATL0', { timeoutMs: 5000 });
    await sendElmCommand(connection, 'ATS0', { timeoutMs: 5000 });
    const response = await sendElmCommand(connection, 'ATI', { timeoutMs: 5000 });
    const normalized = normalizeElmResponse(response || resetResponse);

    if (!normalized) {
      throw new Error('O adaptador conectou, mas nao respondeu ao comando inicial.');
    }

    return normalized;
  } catch (error) {
    await disconnectSharedAdapter();
    throw new Error(obdBluetoothErrorMessage(error));
  }
}

type ElmCommandOptions = {
  settleMs?: number;
  timeoutMs?: number;
};

export async function sendElmCommand(connection: BluetoothConnection, command: string, options: ElmCommandOptions = {}) {
  await connection.clear();
  await connection.send(command);

  if (options.settleMs) {
    await delay(options.settleMs);
  }

  return readElmResponse(connection, options.timeoutMs ?? 4000);
}

async function readElmResponse(connection: BluetoothConnection, timeoutMs: number) {
  const startedAt = Date.now();
  let response = '';
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await connection.available() > 0) {
        response += await connection.read();

        if (response.trim()) {
          return response;
        }
      }
    } catch (error) {
      lastError = error;
    }

    await delay(120);
  }

  if (response.trim()) {
    return response;
  }

  throw lastError instanceof Error ? lastError : new Error('Sem resposta do adaptador dentro do tempo limite.');
}

export function normalizeElmResponse(response: string) {
  return response
    .replace(/\r/g, '\n')
    .replace(/>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function obdBluetoothErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (message.includes('read failed') || message.includes('socket might closed') || message.includes('timeout')) {
    return 'O Bluetooth conectou, mas o adaptador OBD2 nao respondeu. Confirme se o SP359 esta encaixado no carro, com a chave ligada, e tente novamente.';
  }

  if (message.includes('Permission') || message.includes('BLUETOOTH')) {
    return 'Permissao Bluetooth pendente. Volte para a tela inicial e toque em Preparar permissoes.';
  }

  return message || 'Falha ao comunicar com o adaptador OBD2.';
}

export async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') {
    return;
  }

  const permissions = bluetoothPermissions();

  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = Object.values(result).some((value) => value !== PermissionsAndroid.RESULTS.GRANTED);

  if (denied) {
    throw new Error('Permita o Bluetooth para o app listar e conectar no SP359.');
  }
}

export async function ensureBluetoothPermissionsGranted() {
  if (Platform.OS !== 'android') {
    return;
  }

  const permissions = bluetoothPermissions();
  const statuses = await Promise.all(permissions.map((permission) => PermissionsAndroid.check(permission)));

  if (statuses.some((granted) => !granted)) {
    throw new Error('Permissao Bluetooth pendente. Volte para a tela inicial e toque em Preparar permissoes.');
  }
}

export function bluetoothPermissions() {
  if (Platform.OS !== 'android') {
    return [];
  }

  return Platform.Version >= 31
    ? [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
