import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredNavigation, RequestNavigationHistory, NavigationPoint } from '../types/tracking.types';
import { getAppCheckToken } from '../../../shared/utils/appCheck';

const STORAGE_KEY = '@navigation_tracking';
const LAST_SYNC_KEY = '@navigation_last_sync';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const MAX_BODY_BYTES = 99_000;

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

const MIN_REQUEST_INTERVAL_MS = 500;
const MAX_POST_ATTEMPTS = 4;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

class NavigationTrackingService {

    private pendingPoints: Record<string, { points: Record<string, { lat: number; lng: number }>; startTime: number }> = {};
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private lastRequestAt = 0;

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
        this.pendingPoints[navigationId].points[timestamp] = { lat: round6(lat), lng: round6(lng) };
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

    private chunkPoints(
        points: Record<string, NavigationPoint>
    ): Record<string, NavigationPoint>[] {
        const entries = Object.entries(points);
        const batches: Record<string, NavigationPoint>[] = [];
        let current: Record<string, NavigationPoint> = {};
        let currentSize = 0;

        for (const [ts, point] of entries) {
            const entrySize = ts.length + JSON.stringify(point).length + 6;
            if (currentSize + entrySize > MAX_BODY_BYTES && Object.keys(current).length > 0) {
                batches.push(current);
                current = {};
                currentSize = 0;
            }
            current[ts] = point;
            currentSize += entrySize;
        }
        if (Object.keys(current).length > 0) {
            batches.push(current);
        }
        return batches;
    }

    private async throttle(): Promise<void> {
        const wait = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
        if (wait > 0) {
            await sleep(wait);
        }
        this.lastRequestAt = Date.now();
    }

    private async postNavigations(payload: RequestNavigationHistory): Promise<boolean> {
        const token = await AsyncStorage.getItem('@traffic_app_token');
        const appCheckToken = await getAppCheckToken();
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const body = JSON.stringify(payload);

        let backoff = 1000;
        for (let attempt = 1; attempt <= MAX_POST_ATTEMPTS; attempt++) {
            await this.throttle();

            const response = await fetch(`${API_URL}/api/navigation/track-navigation-history`, {
                method: 'POST',
                headers,
                body,
            });

            if (response.ok) {
                return true;
            }

            if (response.status === 429 && attempt < MAX_POST_ATTEMPTS) {
                const retryAfter = response.headers.get('Retry-After');
                const waitMs = retryAfter ? Number(retryAfter) * 1000 : backoff;
                await sleep(Number.isFinite(waitMs) && waitMs > 0 ? waitMs : backoff);
                backoff *= 2;
                continue;
            }

            const text = await response.text().catch(() => '');
            throw new Error(`Sync failed: ${response.status} ${text}`);
        }
        return true;
    }

    private async removeNavigation(navigationId: string): Promise<void> {
        const navigations = await this.getStoredNavigations();
        const remaining = navigations.filter(n => n.navigationId !== navigationId);
        await this.saveStoredNavigations(remaining);
    }

    async syncNavigationHistory(): Promise<boolean> {
        try {
            await this.flushPendingPoints();
            const navigations = await this.getStoredNavigations();

            if (navigations.length === 0) {
                return true;
            }

            let allSucceeded = true;

            for (const nav of navigations) {
                const batches = this.chunkPoints(nav.points);
                let navSucceeded = true;

                for (const points of batches) {
                    try {
                        await this.postNavigations({
                            navigations: [{ navigationId: nav.navigationId, points }],
                        });
                    } catch (error) {
                        console.error('tracking: syncNavigationHistory failed:', error);
                        navSucceeded = false;
                        allSucceeded = false;
                        break;
                    }
                }

                if (navSucceeded) {
                    await this.removeNavigation(nav.navigationId);
                } else {
                    break;
                }
            }

            if (allSucceeded) {
                await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
            }

            return allSucceeded;
        } catch (error) {
            console.error('tracking: syncNavigationHistory failed:', error);
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
