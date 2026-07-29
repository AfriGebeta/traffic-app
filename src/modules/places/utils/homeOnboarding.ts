import AsyncStorage from '@react-native-async-storage/async-storage';
import { placeService } from '../services/place.service';

const HOME_ONBOARDING_KEY = '@traffic_app_home_onboarding_done';
const HOME_LAST_PROMPTED_KEY = '@traffic_app_home_last_prompted';

const COLD_START_PROMPT_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

export const HOME_ADDRESS_ROUTE = '/places/add-home';

const hlog = (...args: any[]) => console.log('home addr', ...args);

export async function markHomeOnboardingDone(): Promise<void> {
    hlog('marking onboarding done');
    await AsyncStorage.setItem(HOME_ONBOARDING_KEY, 'true');
}

export async function resetHomeOnboarding(): Promise<void> {
    hlog('resetting onboarding flag (logout)');
    await AsyncStorage.multiRemove([HOME_ONBOARDING_KEY, HOME_LAST_PROMPTED_KEY]);
}

async function markHomePrompted(): Promise<void> {
    await AsyncStorage.setItem(HOME_LAST_PROMPTED_KEY, String(Date.now()));
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
        await markHomePrompted();
        return HOME_ADDRESS_ROUTE;
    } catch (error) {
        hlog('post-auth check failed, defaulting to add-home:', String(error));
        await markHomePrompted();
        return HOME_ADDRESS_ROUTE;
    }
}

export async function getColdStartHomePromptRoute(): Promise<string | null> {
    try {
        const done = await AsyncStorage.getItem(HOME_ONBOARDING_KEY);
        if (done) {
            return null;
        }

        const lastPrompted = await AsyncStorage.getItem(HOME_LAST_PROMPTED_KEY);
        if (lastPrompted && Date.now() - Number(lastPrompted) < COLD_START_PROMPT_INTERVAL_MS) {
            hlog('cold-start check: prompted recently, skipping');
            return null;
        }

        const savedPlaces = await placeService.getSavedPlaces();
        if (savedPlaces.some(place => place.type === 'HOME')) {
            hlog('cold-start check: HOME already saved');
            await markHomeOnboardingDone();
            return null;
        }

        hlog('cold-start check: due for a re-prompt, no HOME saved');
        await markHomePrompted();
        return HOME_ADDRESS_ROUTE;
    } catch (error) {
        hlog('cold-start check failed, skipping this launch:', String(error));
        return null;
    }
}
