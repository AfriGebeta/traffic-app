import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
  setAttributes,
  setUserId,
  log,
  recordError,
} from '@react-native-firebase/crashlytics';

let initialized = false;

function instance() {
  return getCrashlytics();
}

async function attachDeviceContext(): Promise<void> {
  const crashlytics = instance();

  const architectures = Device.supportedCpuArchitectures ?? [];
  const totalMemoryMb = Device.totalMemory
    ? Math.round(Device.totalMemory / (1024 * 1024))
    : -1;

  await setAttributes(crashlytics, {
    cpu_architectures: architectures.join(',') || 'unknown',
    is_32_bit: String(!architectures.some((arch) => arch.includes('64'))),
    total_memory_mb: String(totalMemoryMb),
    is_low_ram_device: String(totalMemoryMb > 0 && totalMemoryMb < 3072),
    device_model: Device.modelName ?? 'unknown',
    os_version: String(Platform.Version),
    native_app_version: Application.nativeApplicationVersion ?? 'unknown',
    native_build_version: Application.nativeBuildVersion ?? 'unknown',
  });
}

function installGlobalErrorHandler(): void {
  const globalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const crashlytics = instance();
      log(crashlytics, `unhandled JS error (fatal: ${String(isFatal)})`);
      recordError(crashlytics, error);
    } catch {
    }
    globalHandler?.(error, isFatal);
  });
}

export function initializeCrashlytics(): void {
  if (initialized) return;
  initialized = true;

  void (async () => {
    try {
      await setCrashlyticsCollectionEnabled(instance(), !__DEV__);
      await attachDeviceContext();
      installGlobalErrorHandler();
      logBreadcrumb('app: crashlytics initialized');
    } catch (error) {
      console.warn('crashlytics: init failed', error);
    }
  })();
}
export function logBreadcrumb(message: string): void {
  try {
    log(instance(), message);
  } catch {
  }
}

export function recordHandledError(error: unknown, context?: string): void {
  try {
    const crashlytics = instance();
    if (context) log(crashlytics, context);
    recordError(
      crashlytics,
      error instanceof Error ? error : new Error(String(error))
    );
  } catch {
  }
}

export function setCrashlyticsUserId(userId: string): void {
  try {
    void setUserId(instance(), userId);
  } catch {
  }
}
