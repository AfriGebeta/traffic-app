import { Platform } from 'react-native';
import { utils } from '@react-native-firebase/app';

const SIMULATE_NO_PLAY_SERVICES = false;

let cached: boolean | null = null;

export function hasPlayServices(): boolean {
    if (Platform.OS !== 'android') return true;
    if (__DEV__ && SIMULATE_NO_PLAY_SERVICES) {
        if (cached === null) console.log('play services: simulated missing (dev switch)');
        cached = false;
        return false;
    }
    if (cached !== null) return cached;
    try {
        const { isAvailable, status } = utils().playServicesAvailability;
        cached = isAvailable;
        console.log(`play services: ${isAvailable ? 'available' : 'missing'} (status ${status})`);
    } catch (error) {
        console.warn('play services check failed, treating as unavailable', error);
        cached = false;
    }
    return cached;
}
