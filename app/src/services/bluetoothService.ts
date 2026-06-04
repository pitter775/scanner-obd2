import { PermissionsAndroid, Platform } from 'react-native';

import { recordDiagnosticEvent } from './diagnosticLog';
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
  secure?: boolean;
  secureSocket?: boolean;
};

type BluetoothConnectionStrategy = BluetoothConnectionOptions & {
  label: string;
};

type BluetoothModule = {
  cancelDiscovery?: () => Promise<boolean>;
  getBondedDevices?: () => Promise<ClassicDevice[]>;
  pairDevice?: (address: string) => Promise<ClassicDevice>;
  requestBluetoothEnabled?: () => Promise<boolean>;
  startDiscovery?: () => Promise<ClassicDevice[]>;
};

const elmConnectionStrategies: BluetoothConnectionStrategy[] = [
  { charset: 'ascii', delimiter: '', label: 'secure/raw', readSize: 1024, secure: true },
  { charset: 'ascii', delimiter: '>', label: 'secure/prompt', readSize: 1024, secure: true },
  { charset: 'ascii', delimiter: '', label: 'insecure/raw', readSize: 1024, secure: false },
  { charset: 'ascii', delimiter: '>', label: 'insecure/prompt', readSize: 1024, secure: false },
];

let sharedConnection: BluetoothConnection | undefined;
let sharedAddress: string | undefined;
let sharedStrategy: BluetoothConnectionStrategy | undefined;

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

export async function listAvailableDevices(): Promise<BluetoothDeviceInfo[]> {
  await ensureBluetoothPermissionsGranted();
  const bluetooth = getBluetoothModule();
  await bluetooth.requestBluetoothEnabled?.();
  const devices = await bluetooth.startDiscovery?.();

  return (devices ?? []).map((device) => ({
    id: device.id ?? device.address ?? 'unknown',
    name: device.name ?? 'Dispositivo sem nome',
    address: device.address ?? device.id ?? '',
  }));
}

export async function pairBluetoothDevice(address: string): Promise<BluetoothDeviceInfo> {
  await ensureBluetoothPermissionsGranted();
  const bluetooth = getBluetoothModule();
  await bluetooth.cancelDiscovery?.();
  const device = await bluetooth.pairDevice?.(address);

  if (!device) {
    throw new Error('Nao foi possivel parear este dispositivo. Tente parear nas configuracoes do Android.');
  }

  return {
    id: device.id ?? device.address ?? address,
    name: device.name ?? 'Dispositivo sem nome',
    address: device.address ?? device.id ?? address,
  };
}

export class BluetoothConnection {
  private device?: ClassicDevice;
  readonly strategy: BluetoothConnectionStrategy;

  constructor(strategy: BluetoothConnectionStrategy = elmConnectionStrategies[0]) {
    this.strategy = strategy;
  }

  async connect(address: string) {
    await ensureBluetoothPermissionsGranted();
    const bluetooth = getBluetoothModule();
    await bluetooth.cancelDiscovery?.();
    const devices = await bluetooth.getBondedDevices?.();
    const selected = devices?.find((device) => device.address === address || device.id === address);

    if (!selected?.connect) {
      throw new Error('Dispositivo Bluetooth nao encontrado ou sem suporte a conexao.');
    }

    const connected = await selected.connect(connectionOptions(this.strategy));

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

  return connectWithStrategies(address);
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

type ConnectionProgress = (line: string) => void;

export async function testAdapterHandshake(address: string, onProgress?: ConnectionProgress) {
  await disconnectSharedAdapter();
  const errors: string[] = [];

  for (const strategy of orderedConnectionStrategies()) {
    const connection = new BluetoothConnection(strategy);

    try {
      onProgress?.(`Tentando ${strategy.label}`);
      await connection.connect(address);
      onProgress?.(`Socket abriu: ${strategy.label}`);
      recordDiagnosticEvent('info', `Bluetooth conectado com estrategia ${strategy.label}`);
      const response = await runElmHandshake(connection, onProgress);

      sharedConnection = connection;
      sharedAddress = address;
      sharedStrategy = strategy;
      onProgress?.(`Validado: ${strategy.label}`);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      onProgress?.(`Falhou ${strategy.label}: ${message}`);
      errors.push(`${strategy.label}: ${message}`);
      recordDiagnosticEvent('warn', `Estrategia Bluetooth falhou: ${strategy.label}`, error);
      await connection.disconnect();
    }
  }

  throw new Error(obdBluetoothErrorMessage(new Error(errors.join('\n'))));
}

type ElmCommandOptions = {
  settleMs?: number;
  timeoutMs?: number;
};

export async function sendElmCommand(connection: BluetoothConnection, command: string, options: ElmCommandOptions = {}) {
  await connection.clear();
  recordDiagnosticEvent('info', `RAW TX ${command}`, `strategy=${connection.strategy.label}`);
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
  let lastDataAt = 0;
  let lastAvailableLogAt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const available = await connection.available();
      const elapsedMs = Date.now() - startedAt;

      if (available > 0 || elapsedMs - lastAvailableLogAt >= 1000) {
        recordDiagnosticEvent('info', 'RAW available', `strategy=${connection.strategy.label}; bytes=${available}; elapsedMs=${elapsedMs}`);
        lastAvailableLogAt = elapsedMs;
      }

      if (available > 0) {
        const chunk = await connection.read();
        response += chunk;
        recordDiagnosticEvent('info', 'RAW RX chunk', `strategy=${connection.strategy.label}; chunk=${formatRaw(chunk)}; total=${formatRaw(response)}`);
        lastDataAt = Date.now();

        if (response.includes('>')) {
          return response;
        }
      }
    } catch (error) {
      lastError = error;
    }

    if (response.trim() && lastDataAt && Date.now() - lastDataAt > 450) {
      return response;
    }

    await delay(120);
  }

  if (response.trim()) {
    recordDiagnosticEvent('info', 'RAW RX final', `strategy=${connection.strategy.label}; response=${formatRaw(response)}`);
    return response;
  }

  throw lastError instanceof Error ? lastError : new Error('Sem resposta do adaptador dentro do tempo limite.');
}

export function normalizeElmResponse(response: string) {
  return response
    .replace(/\r/g, '\n')
    .replace(/>/g, '')
    .replace(/SEARCHING\.\.\./gi, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function formatRaw(response: string) {
  return response
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

export function obdBluetoothErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (message.includes('Sem resposta') || message.includes('read failed') || message.includes('socket might closed') || message.includes('timeout')) {
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

async function connectWithStrategies(address: string) {
  await disconnectSharedAdapter();
  const errors: string[] = [];

  for (const strategy of orderedConnectionStrategies()) {
    const connection = new BluetoothConnection(strategy);

    try {
      await connection.connect(address);
      sharedConnection = connection;
      sharedAddress = address;
      sharedStrategy = strategy;
      return connection;
    } catch (error) {
      errors.push(`${strategy.label}: ${error instanceof Error ? error.message : String(error ?? '')}`);
      await connection.disconnect();
    }
  }

  throw new Error(errors.join('\n') || 'Nao foi possivel conectar no adaptador.');
}

async function runElmHandshake(connection: BluetoothConnection, onProgress?: ConnectionProgress) {
  const responses: string[] = [];
  const commands: Array<[string, ElmCommandOptions]> = [
    ['ATZ', { settleMs: 1800, timeoutMs: 10000 }],
    ['ATI', { timeoutMs: 7000 }],
    ['ATE0', { timeoutMs: 7000 }],
    ['ATL0', { timeoutMs: 7000 }],
    ['ATS0', { timeoutMs: 7000 }],
    ['ATH0', { timeoutMs: 7000 }],
    ['ATSP0', { timeoutMs: 8000 }],
    ['0100', { timeoutMs: 12000 }],
  ];

  for (const [command, options] of commands) {
    try {
      onProgress?.(`Enviando ${command}`);
      const rawResponse = await sendElmCommand(connection, command, options);
      const normalizedResponse = normalizeElmResponse(rawResponse);
      responses.push(`${command} RAW: ${formatRaw(rawResponse) || 'sem resposta'}`);
      responses.push(`${command} NORMALIZADO: ${normalizedResponse || 'sem resposta'}`);
      recordDiagnosticEvent('info', `ELM ${command} RAW`, formatRaw(rawResponse) || 'sem resposta');
      onProgress?.(`${command}: ${formatRaw(rawResponse) || 'sem resposta'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      responses.push(`${command}: ERRO ${message}`);
      recordDiagnosticEvent('warn', `ELM ${command} falhou`, error);
      onProgress?.(`${command}: erro ${message}`);
    }
  }

  const report = responses.join('\n');

  if (!hasUsefulElmResponse(report)) {
    throw new Error(`Adaptador sem resposta ELM util.\n${report}`);
  }

  return report;
}

function hasUsefulElmResponse(response: string) {
  const normalized = response.toUpperCase();
  return normalized.includes('ELM')
    || normalized.includes('OBD')
    || normalized.includes('OK')
    || normalized.includes('41 00')
    || normalized.includes('4100');
}

function orderedConnectionStrategies() {
  if (!sharedStrategy) {
    return elmConnectionStrategies;
  }

  return [
    sharedStrategy,
    ...elmConnectionStrategies.filter((strategy) => strategy.label !== sharedStrategy?.label),
  ];
}

function connectionOptions(strategy: BluetoothConnectionStrategy): BluetoothConnectionOptions {
  return {
    charset: strategy.charset,
    delimiter: strategy.delimiter,
    readSize: strategy.readSize,
    secure: strategy.secure,
    secureSocket: strategy.secure,
  };
}
