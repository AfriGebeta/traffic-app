import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredNavigation, RequestNavigationHistory } from '../types/tracking.types';

const STORAGE_KEY = '@navigation_tracking';
const LAST_SYNC_KEY = '@navigation_last_sync';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

class NavigationTrackingService {

    private pendingPoints: Record<string, { points: Record<string, { lat: number; lng: number }>; startTime: number }> = {};
    private flushTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.flushTimer = setInterval(() => {
            this.flushPendingPoints();
        }, 30_000);
    }

    private async flushPendingPoints(): Promise<void> {
        if (Object.keys(this.pendingPoints).length === 0) return;
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            const navigations: StoredNavigation[] = stored ? JSON.parse(stored) : [];

            for (const [navId, pending] of Object.entries(this.pendingPoints)) {
                const existing = navigations.find(n => n.navigationId === navId);
                if (existing) {
                    Object.assign(existing.points, pending.points);
                } else {
                    navigations.push({ navigationId: navId, points: pending.points, startTime: pending.startTime });
                }
            }

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(navigations));
            this.pendingPoints = {};
        } catch {
        }
    }

    private async getStoredNavigations(): Promise<StoredNavigation[]> {

        await this.flushPendingPoints();
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

    addNavigationPoint(
        navigationId: string,
        lat: number,
        lng: number
    ): void {
        const timestamp = new Date().toISOString();

        if (!this.pendingPoints[navigationId]) {
            this.pendingPoints[navigationId] = { points: {}, startTime: Date.now() };
        }
        this.pendingPoints[navigationId].points[timestamp] = { lat, lng };
    }

    async shouldSync(): Promise<boolean> {
        try {
            await this.flushPendingPoints();
            const navigations = await this.getStoredNavigations();
            return navigations.length > 0;
        } catch (error) {
            return false;
        }
    }

    async syncNavigationHistory(): Promise<boolean> {
        try {
            await this.flushPendingPoints();
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

    async endNavigationAndSync(navigationId: string): Promise<boolean> {
        try {
            await this.flushPendingPoints();
            return await this.syncNavigationHistory();
        } catch (error) {
            console.error('tracking: Failed to end navigation and sync:', error);
            return false;
        }
    }
}

export const navigationTrackingService = new NavigationTrackingService();
