import { apiService } from '../../../shared/services/api';
import { Neighborhood, NeighborhoodContributionRequest } from '../types/neighborhood.types';

export const neighborhoodService = {
    async contributeNeighborhood(data: NeighborhoodContributionRequest): Promise<Neighborhood> {
        const response = await apiService.post<Neighborhood>('/api/sefers', data);

        if (response.error || !response.data) {
            throw new Error(response.error || 'failed to contribute neighborhood');
        }

        return response.data;
    },

    async getNeighborhoods(): Promise<Neighborhood[]> {
        const response = await apiService.get<Neighborhood[]>('/api/sefers');

        if (response.error || !response.data) {
            throw new Error(response.error || 'failed to fetch neighborhoods');
        }

        return response.data;
    },

    async getNeighborhoodById(id: string): Promise<Neighborhood> {
        const response = await apiService.get<Neighborhood>(`/api/sefers/${id}`);

        if (response.error || !response.data) {
            throw new Error(response.error || 'failed to fetch neighborhood');
        }

        return response.data;
    },
};
