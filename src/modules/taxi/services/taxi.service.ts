import { apiService } from '../../../shared/services/api';
import { CreateTaxiNodeRequest, CreateTaxiEdgeRequest, TaxiNode, TaxiEdge, TaxiNavigationRequest, TaxiNavigationResponse, CreateAvailabilityWindowRequest, AvailabilityWindow } from '../types/taxi.types';

export const taxiService = {
    async createNode(data: CreateTaxiNodeRequest): Promise<TaxiNode> {
        const response = await apiService.post<TaxiNode>(
            '/api/navigation/taxi/contributions/nodes',
            data
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to create node');
        }

        return response.data;
    },

    async getNodes(limit: number = 100): Promise<TaxiNode[]> {
        const response = await apiService.get<TaxiNode[]>(
            `/api/navigation/taxi/contributions/nodes?limit=${limit}`
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch nodes');
        }

        return response.data;
    },

    async getAllNodes(): Promise<TaxiNode[]> {
        const response = await apiService.get<{ data?: TaxiNode[] } | TaxiNode[]>(
            '/api/navigation/taxi/contributions/nodes?limit=1000'
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch all nodes');
        }

        // Handle both response formats
        const data = response.data as any;
        return data.data || data;
    },

    async getAllEdges(): Promise<TaxiEdge[]> {
        const response = await apiService.get<{ data?: TaxiEdge[] } | TaxiEdge[]>(
            '/api/navigation/taxi/contributions/edges?limit=1000'
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch all edges');
        }

        // Handle both response formats
        const data = response.data as any;
        return data.data || data;
    },

    async createEdge(data: CreateTaxiEdgeRequest): Promise<TaxiEdge> {
        const response = await apiService.post<TaxiEdge>(
            '/api/navigation/taxi/contributions/edges',
            data
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to create edge');
        }

        return response.data;
    },

    async getEdges(limit: number = 100): Promise<TaxiEdge[]> {
        const response = await apiService.get<TaxiEdge[]>(
            `/api/navigation/taxi/contributions/edges?limit=${limit}`
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch edges');
        }

        return response.data;
    },

    async requestTaxiNavigation(data: TaxiNavigationRequest): Promise<TaxiNavigationResponse> {
        const response = await apiService.post<{ data: TaxiNavigationResponse }>(
            '/api/navigation/request-taxi-navigation',
            data
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to request taxi navigation');
        }

        return response.data.data;
    },

    async createAvailabilityWindow(data: CreateAvailabilityWindowRequest): Promise<AvailabilityWindow> {
        const response = await apiService.post<AvailabilityWindow>(
            '/api/navigation/taxi/availability-windows',
            data
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to create availability window');
        }

        return response.data;
    },
};
