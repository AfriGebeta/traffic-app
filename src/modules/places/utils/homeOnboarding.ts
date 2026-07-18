import AsyncStorage from '@react-native-async-storage/async-storage';
import { placeService } from '../services/place.service';

const HOME_ONBOARDING_KEY = '@traffic_app_home_onboarding_done';

export const HOME_ADDRESS_ROUTE = '/places/add-home';

const hlog = (...args: any[]) => console.log('home addr', ...args);

export async function markHomeOnboardingDone(): Promise<void> {
    hlog('marking onboarding done');
    await AsyncStorage.setItem(HOME_ONBOARDING_KEY, 'true');
}

export async function resetHomeOnboarding(): Promise<void> {
    hlog('resetting onboarding flag (logout)');
    await AsyncStorage.removeItem(HOME_ONBOARDING_KEY);
}

export async function getPostAuthRoute(): Promise<string> {
    try {
        const done = await AsyncStorage.getItem(HOME_ONBOARDING_KEY);
        if (done) {
            hlog('post-auth route: / (onboarding flag already set)');
            return '/';
        }

        const savedPlaces = await placeService.getSavedPlaces();
        hlog(`post-auth check: ${savedPlaces.length} saved place(s)`, savedPlaces.map(p => p.type));
        if (savedPlaces.some(place => place.type === 'HOME')) {
            hlog('post-auth route: / (HOME already saved)');
            await markHomeOnboardingDone();
            return '/';
        }

        hlog('post-auth route: add-home (no HOME saved)');
        return HOME_ADDRESS_ROUTE;
    } catch (error) {
        hlog('post-auth check failed, defaulting to add-home:', String(error));
        return HOME_ADDRESS_ROUTE;
    }
}
