import { useEffect, useRef } from 'react';

export const useTaxiRouteRecovery = ({ needsRoute, location, recalculateRoute, isNavigatingRef }: {
    needsRoute: boolean;
    location: { lat: number; lng: number } | null;
    recalculateRoute: (location: { lat: number; lng: number }) => Promise<void>;
    isNavigatingRef: React.MutableRefObject<boolean>;
}) => {
    const latest = useRef({ location, recalculateRoute });
    latest.current = { location, recalculateRoute };
    const hasLocation = !!location;
    useEffect(() => {
        if (!needsRoute || !hasLocation) return;
        const retry = () => {
            const { location: fix, recalculateRoute: recalculate } = latest.current;
            if (fix && isNavigatingRef.current) void recalculate(fix);
        };
        retry();
        const timer = setInterval(retry, 3000);
        return () => clearInterval(timer);
    }, [needsRoute, hasLocation, isNavigatingRef]);
};
