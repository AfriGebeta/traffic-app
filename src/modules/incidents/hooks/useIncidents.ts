import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { incidentService } from '../services/incident.service';
import { incidentPreferencesService } from '../services/preferences.service';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';
import { Incident } from '../types/incident.types';

const sameIncidents = (a: Incident[], b: Incident[]) =>
    a.length === b.length &&
    a.every((incident, i) =>
        incident.id === b[i].id &&
        incident.confirmed === b[i].confirmed &&
        incident.upvotes === b[i].upvotes &&
        incident.downvotes === b[i].downvotes
    );

export const useIncidents = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);
    const lastFetchAt = useRef(0);

    const fetchIncidents = useCallback(async (silent = false) => {
        if (inFlight.current) return;
        inFlight.current = true;

        try {
            if (!silent) setLoading(true);

            const filters = await incidentPreferencesService.getFilters();
            const enabledTypes = filters.enabledTypes.length > 0 ? filters.enabledTypes : undefined;

            const response = await incidentService.getIncidents(enabledTypes);

            if (response.error) {
                if (!silent) setError(response.error);
            } else if (response.data) {
                const next = response.data;
                setIncidents((prev) => (sameIncidents(prev, next) ? prev : next));
                setError(null);
            }
        } catch (err) {
            if (!silent) setError('failed to fetch incidents');
            console.error('Error fetching incidents:', err);
        } finally {
            lastFetchAt.current = Date.now();
            inFlight.current = false;
            if (!silent) setLoading(false);
        }
    }, []);

    const refetch = useCallback(() => fetchIncidents(false), [fetchIncidents]);

    useEffect(() => {
        fetchIncidents();
    }, [fetchIncidents]);

    useEffect(() => {
        const intervalMs = getAppConfig().incidentPollIntervalMs;
        let timer: ReturnType<typeof setInterval> | null = null;

        const startPolling = () => {
            if (timer) return;
            timer = setInterval(() => fetchIncidents(true), intervalMs);
        };

        const stopPolling = () => {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
        };

        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                if (Date.now() - lastFetchAt.current >= intervalMs) fetchIncidents(true);
                startPolling();
            } else {
                stopPolling();
            }
        };

        startPolling();
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            stopPolling();
            subscription.remove();
        };
    }, [fetchIncidents]);

    return {
        incidents,
        loading,
        error,
        refetch,
    };
};
