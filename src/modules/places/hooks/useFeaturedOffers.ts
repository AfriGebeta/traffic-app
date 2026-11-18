import { useEffect, useRef, useState } from 'react';
import { businessService } from '../services/business.service';
import { FeaturedOffer } from '../types/business.types';

const REFETCH_MS = 5 * 60 * 1000;
const MOVED_M = 1000;

const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const rad = Math.PI / 180;
    const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    const y = (b.lat - a.lat) * rad;
    return Math.sqrt(x * x + y * y) * 6371000;
};

export function useFeaturedOffers(location: { lat: number; lng: number } | null, enabled = true) {
    const [offers, setOffers] = useState<FeaturedOffer[]>([]);
    const [loaded, setLoaded] = useState(false);
    const last = useRef<{ at: number; lat: number; lng: number } | null>(null);
    const inFlight = useRef(false);
    const [tick, setTick] = useState(0);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;
        const timer = setInterval(() => setTick((n) => n + 1), REFETCH_MS);
        return () => clearInterval(timer);
    }, [enabled]);

    const lat = location?.lat;
    const lng = location?.lng;
    useEffect(() => {
        if (!enabled || lat == null || lng == null || inFlight.current) return;
        const prev = last.current;
        const fresh = prev && Date.now() - prev.at < REFETCH_MS && metresBetween(prev, { lat, lng }) < MOVED_M;
        if (fresh) return;
        inFlight.current = true;
        last.current = { at: Date.now(), lat, lng };
        businessService
            .featuredOffers(lat, lng)
            .then((rows) => {
                if (mounted.current) setOffers(rows.filter((row) => row?.place?.id && row?.offer?.id));
            })
            .catch(() => undefined)
            .finally(() => {
                inFlight.current = false;
                if (mounted.current) setLoaded(true);
            });
    }, [enabled, lat, lng, tick]);

    return { offers, loaded };
}
