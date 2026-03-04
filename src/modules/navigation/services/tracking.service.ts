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
            return [];
        }
    }

    private async saveStoredNavigations(navigations: StoredNavigation[]): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(navigations));
        } catch (error) {
           
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
                return true;
            }

            const lastSyncTime = parseInt(lastSync, 10);
            const now = Date.now();
            const hoursSinceSync = (now - lastSyncTime) / (1000 * 60 * 60);

            return hoursSinceSync >= 24;
        } catch (error) {
            return false;
        }
    }

    async syncNavigationHistory(): Promise<boolean> {
        try {
            const navigations = await this.getStoredNavigations();

            if (navigations.length === 0) {
                return true;
            }

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
                throw new Error(`Sync failed: ${response.status}`);
            }

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
            await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

            return true;
        } catch (error) {
            return false;
        }
    }

    async checkAndSync(): Promise<void> {
        const shouldSync = await this.shouldSync();
        if (shouldSync) {
            await this.syncNavigationHistory();
        }
    }
}

export const navigationTrackingService = new NavigationTrackingService();
