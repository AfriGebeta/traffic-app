import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { isNotificationAskPending } from '../services/notificationPermission';
import { logBreadcrumb } from './crashlytics';

const REVIEW_ENABLED = true;
const REVIEW_INTERVAL_DAYS = 14;
const REVIEW_DELAY_MS = 2500;
const LAST_PROMPT_KEY = '@traffic_app_review_last_prompt_at';

export type ReviewTrigger = 'arrival' | 'contribution' | 'claim' | 'offer';

let scheduled = false;

const isDue = async (): Promise<boolean> => {
    const last = Number(await AsyncStorage.getItem(LAST_PROMPT_KEY));
    return !last || Date.now() - last >= REVIEW_INTERVAL_DAYS * 86_400_000;
};

export async function maybeAskForReview(trigger: ReviewTrigger): Promise<void> {
    if (!REVIEW_ENABLED || scheduled) return;
    try {
        if (!(await isDue())) return;
        if (!(await StoreReview.isAvailableAsync())) return;
    } catch {
        return;
    }
    scheduled = true;
    setTimeout(async () => {
        try {
            if (isNotificationAskPending() || !(await isDue())) return;
            await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
            logBreadcrumb(`in-app review requested (${trigger})`);
            await StoreReview.requestReview();
        } catch {
            
        } finally {
            scheduled = false;
        }
    }, REVIEW_DELAY_MS);
}
