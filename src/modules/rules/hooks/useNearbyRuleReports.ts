import { useState, useEffect } from 'react';
import { ruleService } from '../services/rule.service';
import { TrafficRuleReport } from '../types/rule.types';

interface UseNearbyRuleReportsProps {
    lat: number;
    lng: number;
    radius?: number;
    enabled?: boolean;
}

export const useNearbyRuleReports = ({ lat, lng, radius = 100, enabled = true }: UseNearbyRuleReportsProps) => {
    const [reports, setReports] = useState<TrafficRuleReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNearbyReports = async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await ruleService.getNearbyReports(lat, lng, radius);
            setReports(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch nearby reports');
            console.error('Error fetching nearby rule reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNearbyReports();
    }, [lat, lng, radius, enabled]);

    return {
        reports,
        loading,
        error,
        refetch: fetchNearbyReports,
    };
};
