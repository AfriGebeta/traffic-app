import telemetryService from '../../../shared/services/telemetry.service';

// same deviceId as the INSTALL event, so the backend can link this account to the install
// (and to the referral link it came from)
export async function withDeviceId<T extends object>(body: T, endpoint: string): Promise<T & { deviceId?: string }> {
    try {
        const deviceId = await telemetryService.getDeviceId();
        console.log('referral auth:', endpoint, 'deviceId', deviceId);
        return { ...body, deviceId };
    } catch (error) {
        console.log('referral auth:', endpoint, 'no deviceId', String(error));
        return body;
    }
}
