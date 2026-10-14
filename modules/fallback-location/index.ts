import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { LocationObject } from 'expo-location';

type FallbackLocationNative = {
  getLastKnown(maxAgeMs: number | null): Promise<LocationObject | null>;
  getCurrent(timeoutMs: number, highAccuracy: boolean): Promise<LocationObject>;
  startWatch(id: number, intervalMs: number): Promise<void>;
  stopWatch(id: number): void;
  addListener(
    event: 'onLocation',
    listener: (event: { id: number; location: LocationObject }) => void
  ): { remove(): void };
};

// android only: LocationManager-based location for devices without Google Play Services
const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<FallbackLocationNative>('FallbackLocation')
    : null;

function requireNative(): FallbackLocationNative {
  if (!native) throw new Error('FallbackLocation native module is not available (rebuild the app)');
  return native;
}

export function getFallbackLastKnown(maxAgeMs?: number): Promise<LocationObject | null> {
  return requireNative().getLastKnown(maxAgeMs ?? null);
}

export function getFallbackCurrent(timeoutMs: number, highAccuracy: boolean): Promise<LocationObject> {
  return requireNative().getCurrent(timeoutMs, highAccuracy);
}

let nextWatchId = 1;

export async function watchFallbackPosition(
  intervalMs: number,
  callback: (location: LocationObject) => void
): Promise<{ remove(): void }> {
  const module = requireNative();
  const id = nextWatchId++;
  const subscription = module.addListener('onLocation', (event) => {
    if (event.id === id) callback(event.location);
  });
  try {
    await module.startWatch(id, intervalMs);
  } catch (error) {
    subscription.remove();
    throw error;
  }
  return {
    remove: () => {
      subscription.remove();
      module.stopWatch(id);
    },
  };
}
