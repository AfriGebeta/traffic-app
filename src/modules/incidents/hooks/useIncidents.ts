import { useState, useEffect } from 'react';
import { incidentService } from '../services/incident.service';
import { incidentPreferencesService } from '../services/preferences.service';
import { Incident } from '../types/incident.types';

export const useIncidents = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchIncidents = async () => {
        try {
            setLoading(true);

            const filters = await incidentPreferencesService.getFilters();
            const enabledTypes = filters.enabledTypes.length > 0 ? filters.enabledTypes : undefined;

            const response = await incidentService.getIncidents(enabledTypes);

            if (response.error) {
                setError(response.error);
            } else if (response.data) {
                setIncidents(response.data);
                setError(null);
            }
        } catch (err) {
            setError('failed to fetch incidents');
            console.error('Error fetching incidents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncidents();
    }, []);

    return {
        incidents,
        loading,
        error,
        refetch: fetchIncidents,
    };
};
