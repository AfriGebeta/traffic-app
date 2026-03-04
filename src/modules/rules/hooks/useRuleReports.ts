import { useState, useEffect } from 'react';
import { ruleService } from '../services/rule.service';
import { TrafficRuleReport } from '../types/rule.types';

export const useRuleReports = () => {
    const [reports, setReports] = useState<TrafficRuleReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await ruleService.getAllReports();
            setReports(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch reports');
            console.error('Error fetching rule reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    return {
        reports,
        loading,
        error,
        refetch: fetchReports,
    };
};
