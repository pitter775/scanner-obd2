import { Platform, Share } from 'react-native';

import { isCloudSyncEnabled, isSupabaseConfigured } from '../config/env';
import { type DiagnosticEvent, useAppStore } from '../store/appStore';

let consoleDiagnosticsInstalled = false;
let globalErrorDiagnosticsInstalled = false;

export function recordDiagnosticEvent(level: 'error' | 'info' | 'warn', message: string, details?: unknown) {
  useAppStore.getState().appendDiagnosticEvent({
    details: details === undefined ? undefined : stringifyDetails(details),
    level,
    message,
  });
}

export function installConsoleDiagnostics() {
  if (consoleDiagnosticsInstalled) {
    return;
  }

  consoleDiagnosticsInstalled = true;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    recordDiagnosticEvent('warn', stringifyConsoleArgs(args));
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    recordDiagnosticEvent('error', stringifyConsoleArgs(args));
    originalError(...args);
  };

  installGlobalErrorDiagnostics();
}

function installGlobalErrorDiagnostics() {
  if (globalErrorDiagnosticsInstalled) {
    return;
  }

  const errorUtils = (globalThis as { ErrorUtils?: {
    getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;

  if (!errorUtils?.setGlobalHandler) {
    return;
  }

  globalErrorDiagnosticsInstalled = true;
  const originalHandler = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    recordDiagnosticEvent(isFatal ? 'error' : 'warn', isFatal ? 'Erro fatal no app' : 'Erro no app', error);
    originalHandler?.(error, isFatal);
  });
}

export async function shareDiagnosticReport() {
  await Share.share({
    message: buildDiagnosticReport(),
    title: 'Relatorio Scanner OBD2',
  });
}

export function buildDiagnosticReport() {
  const state = useAppStore.getState();

  return [
    'RELATORIO SCANNER OBD2',
    `Gerado em: ${new Date().toISOString()}`,
    `Plataforma: ${Platform.OS} ${Platform.Version}`,
    `Supabase: ${isSupabaseConfigured ? 'configurado' : 'nao configurado'}`,
    `Nuvem: ${isCloudSyncEnabled ? 'ativa' : 'desativada'}`,
    '',
    'ADAPTADOR',
    state.activeAdapter ? `${state.activeAdapter.name} (${state.activeAdapter.address})` : 'nenhum',
    `Conexao validada: ${state.connectionReady ? 'sim' : 'nao'}`,
    '',
    'VEICULO',
    state.activeVehicle ? `${state.activeVehicle.make} ${state.activeVehicle.model} ${state.activeVehicle.year}` : 'nenhum',
    state.fingerprint ? JSON.stringify(state.fingerprint, null, 2) : 'Fingerprint: nenhum',
    '',
    'ERROS E AVISOS',
    state.diagnosticEvents.length
      ? state.diagnosticEvents.map((event) => formatDiagnosticEvent(event)).join('\n')
      : 'nenhum',
    '',
    'LOG OBD2',
    state.communicationLog.length ? state.communicationLog.join('\n') : 'nenhum',
    '',
    'LEITURAS',
    state.readings.length ? JSON.stringify(state.readings, null, 2) : 'nenhuma',
    '',
    'DTCs',
    state.dtcs.length ? JSON.stringify(state.dtcs, null, 2) : 'nenhum',
  ].join('\n');
}

function formatDiagnosticEvent(event: DiagnosticEvent) {
  return [
    `[${event.at}] ${event.level.toUpperCase()}: ${event.message}`,
    event.details ? `Detalhes: ${event.details}` : '',
  ].filter(Boolean).join('\n');
}

function stringifyConsoleArgs(args: unknown[]) {
  return args.map((arg) => stringifyDetails(arg)).join(' ');
}

function stringifyDetails(details: unknown) {
  if (details instanceof Error) {
    return `${details.name}: ${details.message}${details.stack ? `\n${details.stack}` : ''}`;
  }

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}
