import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredNavigation, RequestNavigationHistory } from '../types/tracking.types';

const STORAGE_KEY = '@navigation_tracking';
const LAST_SYNC_KEY = '@navigation_last_sync';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

class NavigationTrackingService {
    private async getStoredNavigations(): Promise<StoredNavigation[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('error reading stored navigations:', error);
            return [];
        }
    }

    private async saveStoredNavigations(navigations: StoredNavigation[]): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(navigations));
        } catch (error) {
            console.error('error saving navigations:', error);
        }
    }

    async addNavigationPoint(
        navigationId: string,
        lat: number,
        lng: number
    ): Promise<void> {
        const navigations = await this.getStoredNavigations();
        const timestamp = new Date().toISOString();

        const existingNav = navigations.find(n => n.navigationId === navigationId);

        if (existingNav) {
            existingNav.points[timestamp] = { lat, lng };
        } else {
            navigations.push({
                navigationId,
                points: { [timestamp]: { lat, lng } },
                startTime: Date.now(),
            });
        }

        await this.saveStoredNavigations(navigations);
    }

    async shouldSync(): Promise<boolean> {
        try {
            const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
            if (!lastSync) {
                console.log('tracking: No previous sync found - will sync');
                return true;
            }

            const lastSyncTime = parseInt(lastSync, 10);
            const now = Date.now();
            const hoursSinceSync = (now - lastSyncTime) / (1000 * 60 * 60);

            const shouldSync = hoursSinceSync >= 24;
            console.log(`for tracking: Hours since last sync: ${hoursSinceSync.toFixed(1)}h - ${shouldSync ? 'will sync' : 'will not sync'}`);

            return shouldSync;
        } catch (error) {
            console.error('error checking sync time:', error);
            return false;
        }
    }

    async syncNavigationHistory(): Promise<boolean> {
        try {
            const navigations = await this.getStoredNavigations();

            if (navigations.length === 0) {
                console.log('tacking: No navigation data to sync');
                return true;
            }

            console.log(`[tracking: Syncing ${navigations.length} navigation(s) to ${API_URL}`);

            const payload: RequestNavigationHistory = {
                navigations: navigations.map(({ navigationId, points }) => ({
                    navigationId,
                    points,
                })),
            };

            const token = await AsyncStorage.getItem('@traffic_app_token');
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_URL}/api/navigation/track-navigation-history`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('tracking: Sync failed with status:', response.status, 'body:', errorText);
                throw new Error(`Sync failed: ${response.status}`);
            }

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
            await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

            console.log(`tracking: Successfully synced ${navigations.length} navigation(s)`);
            return true;
        } catch (error) {
            console.error('tracking: Error syncing navigation history:', error);
            return false;
        }
    }

    async checkAndSync(): Promise<void> {
        console.log('tracking: Checking if sync needed...');
        const shouldSync = await this.shouldSync();
        if (shouldSync) {
            console.log('tracking: Starting auto-sync...');
            await this.syncNavigationHistory();
        } else {
            console.log('tracking: No sync needed yet');
        }
    }
}

export const navigationTrackingService = new NavigationTrackingService();
