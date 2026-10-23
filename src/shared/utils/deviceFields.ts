import * as Location from '../services/location';
import telemetryService from '../services/telemetry.service';

// backend scores contributions against where the phone actually is; a missing
// device location counts against the submission, so send whatever we have
export interface DeviceFields {
    deviceLat?: number;
    deviceLng?: number;
    deviceAccuracy?: number;
    mockLocation?: boolean;
    deviceId?: string;
}

const MAX_FIX_AGE_MS = 60 * 1000;

export const getDeviceFields = async (): Promise<DeviceFields> => {
    const fields: DeviceFields = {};

    try {
        fields.deviceId = await telemetryService.getDeviceId();
    } catch {
    }

    try {
        const fix = await Location.getLastKnownPositionAsync({ maxAge: MAX_FIX_AGE_MS });
        if (fix) {
            fields.deviceLat = fix.coords.latitude;
            fields.deviceLng = fix.coords.longitude;
            if (fix.coords.accuracy != null) fields.deviceAccuracy = Math.round(fix.coords.accuracy);
            // only Android reports this; leave it out rather than claim false
            if (typeof fix.mocked === 'boolean') fields.mockLocation = fix.mocked;
        }
    } catch {
    }

    return fields;
};
