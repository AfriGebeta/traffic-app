import type { LocationObject } from '../services/location';
import type { DeviceFields } from './deviceFields';

export const gpsLog = (...args: unknown[]) => {
    if (__DEV__) console.log('[camera-gps]', ...args);
};

export interface PhotoFix {
    lat: number;
    lng: number;
    accuracy?: number;
    // only Android reports this
    mocked?: boolean;
    timestamp: number;
}

export const PHOTO_PIN_LIMIT_M = {
    place: 80,
    taxi_station: 80,
    incident: 300,
} as const;

export const toPhotoFix = (location: LocationObject): PhotoFix => ({
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ...(location.coords.accuracy != null && { accuracy: location.coords.accuracy }),
    ...(typeof location.mocked === 'boolean' && { mocked: location.mocked }),
    timestamp: location.timestamp,
});

// the most recent photo that carries a fix
export const latestPhotoFix = (photos: { fix?: PhotoFix | null }[]): PhotoFix | null =>
    photos.reduce<PhotoFix | null>((latest, photo) => (photo.fix && (!latest || photo.fix.timestamp > latest.timestamp) ? photo.fix : latest), null);

export const deviceFieldsFromFix = (fix: PhotoFix): DeviceFields => {
    const fields: DeviceFields = {
        deviceLat: fix.lat,
        deviceLng: fix.lng,
        ...(fix.accuracy != null && { deviceAccuracy: Math.round(fix.accuracy) }),
        ...(typeof fix.mocked === 'boolean' && { mockLocation: fix.mocked }),
    };
    gpsLog('submit: device fields from photo fix', fields, `fix age ${Math.round((Date.now() - fix.timestamp) / 1000)}s`);
    return fields;
};

export const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// metres between the pin and the photo when that's over the limit; null when fine or nothing to compare
export const photoPinGap = (
    pin: { lat: number; lng: number } | null | undefined,
    fix: PhotoFix | null,
    limit: number
): number | null => {
    if (!pin || !fix) return null;
    const gap = distanceMeters(pin, fix);
    return gap > limit ? Math.round(gap) : null;
};
