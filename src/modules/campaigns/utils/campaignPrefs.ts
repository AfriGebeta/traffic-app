import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_BANNERS_KEY = '@campaign_banners_seen';
const LAST_TRACK_KEY = '@campaign_last_track';

const readSeen = async (): Promise<string[]> => {
    try {
        const raw = await AsyncStorage.getItem(SEEN_BANNERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const getSeenBannerSlugs = readSeen;

export const markBannerSeen = async (slug: string): Promise<void> => {
    const seen = await readSeen();
    if (seen.includes(slug)) return;
    await AsyncStorage.setItem(SEEN_BANNERS_KEY, JSON.stringify([...seen, slug])).catch(() => undefined);
};

export const getLastTrackKey = async (): Promise<string | null> =>
    AsyncStorage.getItem(LAST_TRACK_KEY).catch(() => null);

export const setLastTrackKey = (key: string): Promise<void> =>
    AsyncStorage.setItem(LAST_TRACK_KEY, key).catch(() => undefined);

const TOUR_SEEN_KEY = '@campaign_tour_seen';

export const hasSeenCampaignTour = async (): Promise<boolean> =>
    (await AsyncStorage.getItem(TOUR_SEEN_KEY).catch(() => null)) === 'true';

export const markCampaignTourSeen = (): Promise<void> =>
    AsyncStorage.setItem(TOUR_SEEN_KEY, 'true').catch(() => undefined);
