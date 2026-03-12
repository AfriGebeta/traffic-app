import { useState, useEffect } from 'react';
import { incidentPreferencesService, IncidentFilters } from '../services/preferences.service';
import { INCIDENT_TYPES } from '../types/incident.types';

export const useIncidentFilters = () => {
    const [filters, setFilters] = useState<IncidentFilters>({ enabledTypes: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFilters();
    }, []);

    const loadFilters = async () => {
        try {
            const savedFilters = await incidentPreferencesService.getFilters();
            setFilters(savedFilters);
        } catch (error) {
            console.error('Failed to load filters:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleType = async (typeName: string) => {
        try {
            const allTypes = INCIDENT_TYPES.map(t => t.name);
            const currentEnabled = filters.enabledTypes.length === 0 ? allTypes : filters.enabledTypes;

            let newEnabled: string[];
            if (currentEnabled.includes(typeName)) {
                newEnabled = currentEnabled.filter(t => t !== typeName);
            } else {
                newEnabled = [...currentEnabled, typeName];
            }

            const finalEnabled = newEnabled.length === allTypes.length ? [] : newEnabled;

            const newFilters = { enabledTypes: finalEnabled };
            await incidentPreferencesService.saveFilters(newFilters);
            setFilters(newFilters);
        } catch (error) {
            console.error('Failed to toggle filter:', error);
        }
    };

    const isTypeEnabled = (typeName: string): boolean => {
        if (filters.enabledTypes.length === 0) {
            return true;
        }
        return filters.enabledTypes.includes(typeName);
    };

    return {
        filters,
        loading,
        toggleType,
        isTypeEnabled,
    };
};
