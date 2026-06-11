import AsyncStorage from '@react-native-async-storage/async-storage';

const ROUTE_CACHE_KEY = '@taxi_route_cache';

export interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
}

export interface EdgePrice {
    from: number;
    to: number;
    fromName: string;
    toName: string;
    cost: string;
}

export interface CachedRouteData {
    routeName: string;
    startStation: RouteStop | null;
    endStation: RouteStop | null;
    intermediateStops: RouteStop[];
    edgePrices?: EdgePrice[];
    currentStep: 'builder' | 'pricing' | 'availability';
    timestamp: number;
}

class RouteCacheService {
    async saveRouteCache(data: CachedRouteData): Promise<void> {
        try {
            const cacheData = {
                ...data,
                timestamp: Date.now(),
            };
            await AsyncStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            console.error('failed to save route cache:', error);
        }
    }

    async getRouteCache(): Promise<CachedRouteData | null> {
        try {
            const cached = await AsyncStorage.getItem(ROUTE_CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached) as CachedRouteData;

                return data;
            }
            return null;
        } catch (error) {

            return null;
        }
    }

    async clearRouteCache(): Promise<void> {
        try {
            await AsyncStorage.removeItem(ROUTE_CACHE_KEY);
        } catch (error) {
            console.error('failed to clear route cache:', error);
        }
    }

    async hasCachedRoute(): Promise<boolean> {
        try {
            const cached = await AsyncStorage.getItem(ROUTE_CACHE_KEY);
            return cached !== null;
        } catch (error) {
            console.error('failed to check cache:', error);
            return false;
        }
    }
}

export const routeCacheService = new RouteCacheService();
