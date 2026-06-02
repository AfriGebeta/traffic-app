import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { routeCacheService, CachedRouteData } from '../services/route-cache.service';
import { useCollectorTracking } from '../hooks/useCollectorTracking';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
}

interface RouteBuilderContextType {
    pendingStop: RouteStop | null;
    setPendingStop: (stop: RouteStop | null) => void;
    pickType: 'start' | 'end' | 'intermediate' | null;
    setPickType: (type: 'start' | 'end' | 'intermediate' | null) => void;
    cachedRoute: CachedRouteData | null;
    loadCachedRoute: () => Promise<void>;
    clearCache: () => Promise<void>;
    isCollecting: boolean;
    setIsCollecting: (value: boolean) => void;
    currentRouteName: string;
    setCurrentRouteName: (name: string) => void;
    endCollectorTracking: () => Promise<boolean>;
}

const RouteBuilderContext = createContext<RouteBuilderContextType | undefined>(undefined);

export function RouteBuilderProvider({ children }: { children: ReactNode }) {
    const [pendingStop, setPendingStop] = useState<RouteStop | null>(null);
    const [pickType, setPickType] = useState<'start' | 'end' | 'intermediate' | null>(null);
    const [cachedRoute, setCachedRoute] = useState<CachedRouteData | null>(null);
    const [isCollecting, setIsCollecting] = useState<boolean>(false);
    const [currentRouteName, setCurrentRouteName] = useState<string>('');

    const { endTracking } = useCollectorTracking({
        isCollecting,
        routeName: currentRouteName,
    });

    const loadCachedRoute = async () => {
        const cached = await routeCacheService.getRouteCache();
        setCachedRoute(cached);
    };

    const clearCache = async () => {
        await routeCacheService.clearRouteCache();
        setCachedRoute(null);
    };

    useEffect(() => {
        loadCachedRoute();
    }, []);

    return (
        <RouteBuilderContext.Provider
            value={{
                pendingStop,
                setPendingStop,
                pickType,
                setPickType,
                cachedRoute,
                loadCachedRoute,
                clearCache,
                isCollecting,
                setIsCollecting,
                currentRouteName,
                setCurrentRouteName,
                endCollectorTracking: endTracking,
            }}
        >
            {children}
        </RouteBuilderContext.Provider>
    );
}

export function useRouteBuilder() {
    const context = useContext(RouteBuilderContext);
    if (context === undefined) {
        throw new Error('useRouteBuilder must be used within a RouteBuilderProvider');
    }
    return context;
}
