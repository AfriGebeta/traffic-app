import { useState, useEffect } from 'react';
import { incidentService } from '../services/incident.service';
import { Incident } from '../types/incident.types';

export const useIncidents = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchIncidents = async () => {
        try {
            setLoading(true);
            const response = await incidentService.getIncidents();

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
