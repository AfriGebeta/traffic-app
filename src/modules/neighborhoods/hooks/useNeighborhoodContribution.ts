import { useState } from 'react';
import { neighborhoodService } from '../services/neighborhood.service';
import { NeighborhoodContributionRequest, Neighborhood } from '../types/neighborhood.types';

export const useNeighborhoodContribution = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contributeNeighborhood = async (data: NeighborhoodContributionRequest): Promise<Neighborhood | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await neighborhoodService.contributeNeighborhood(data);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to contribute neighborhood';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        contributeNeighborhood,
        loading,
        error,
    };
};
