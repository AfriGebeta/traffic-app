import * as ExpoLocation from 'expo-location';
import {
    getFallbackCurrent,
    getFallbackLastKnown,
    watchFallbackPosition,
} from '../../../modules/fallback-location';
import { hasPlayServices } from '../utils/playServices';

// passed through unchanged; add here when a caller needs more of expo-location
export {
    Accuracy,
    getForegroundPermissionsAsync,
    requestForegroundPermissionsAsync,
} from 'expo-location';
export type {
    LocationObject,
    LocationObjectCoords,
    LocationSubscription,
    LocationTaskOptions,
} from 'expo-location';

const DEFAULT_WATCH_INTERVAL_MS = 1000;
const HIGH_ACCURACY_TIMEOUT_MS = 20000;
const LOW_ACCURACY_TIMEOUT_MS = 10000;

const isHighAccuracy = (accuracy?: ExpoLocation.Accuracy) =>
    (accuracy ?? ExpoLocation.Accuracy.Balanced) >= ExpoLocation.Accuracy.High;

export async function getCurrentPositionAsync(
    options: ExpoLocation.LocationOptions = {}
): Promise<ExpoLocation.LocationObject> {
    if (hasPlayServices()) return ExpoLocation.getCurrentPositionAsync(options);

    const highAccuracy = isHighAccuracy(options.accuracy);
    return getFallbackCurrent(highAccuracy ? HIGH_ACCURACY_TIMEOUT_MS : LOW_ACCURACY_TIMEOUT_MS, highAccuracy);
}

export async function getLastKnownPositionAsync(
    options: ExpoLocation.LocationLastKnownOptions = {}
): Promise<ExpoLocation.LocationObject | null> {
    if (hasPlayServices()) return ExpoLocation.getLastKnownPositionAsync(options);

    const location = await getFallbackLastKnown(options.maxAge);
    if (location && options.requiredAccuracy != null && (location.coords.accuracy ?? Infinity) > options.requiredAccuracy) {
        return null;
    }
    return location;
}

export async function watchPositionAsync(
    options: ExpoLocation.LocationOptions,
    callback: ExpoLocation.LocationCallback,
    errorHandler?: (reason: string) => void
): Promise<ExpoLocation.LocationSubscription> {
    if (hasPlayServices()) return ExpoLocation.watchPositionAsync(options, callback, errorHandler);

    try {
        return await watchFallbackPosition(options.timeInterval ?? DEFAULT_WATCH_INTERVAL_MS, callback);
    } catch (error) {
        errorHandler?.(error instanceof Error ? error.message : String(error));
        throw error;
    }
}

export async function startLocationUpdatesAsync(
    taskName: string,
    options?: ExpoLocation.LocationTaskOptions
): Promise<void> {
    if (hasPlayServices()) return ExpoLocation.startLocationUpdatesAsync(taskName, options);
    console.log('location: background updates skipped (no Play Services)');
}

export async function stopLocationUpdatesAsync(taskName: string): Promise<void> {
    if (hasPlayServices()) return ExpoLocation.stopLocationUpdatesAsync(taskName);
}

export async function hasStartedLocationUpdatesAsync(taskName: string): Promise<boolean> {
    if (hasPlayServices()) return ExpoLocation.hasStartedLocationUpdatesAsync(taskName);
    return false;
}
