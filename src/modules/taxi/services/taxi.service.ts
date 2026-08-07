import { apiService } from '../../../shared/services/api';
import {
    CreateTaxiNodeRequest,
    CreateTaxiEdgeRequest,
    TaxiNode,
    TaxiEdge,
    TaxiNavigationRequest,
    TaxiNavigationResponse,
    CreateAvailabilityWindowRequest,
    AvailabilityWindow,
    TaxiRoute,
    CreateTaxiRouteRequest,
    TaxiRouteStop,
    CreateTaxiRouteStopRequest
} from '../types/taxi.types';

const NODES_PAGE_LIMIT = 100;
const NODES_MAX_PAGES = 100;

interface NodesPageInfo {
    limit: number;
    cursor: number | null;
    nextCursor: number | null;
    hasMore: boolean;
}

async function fetchAllContributionNodes(): Promise<TaxiNode[]> {
    const nodes: TaxiNode[] = [];
    let cursor: number | null = null;

    for (let page = 0; page < NODES_MAX_PAGES; page++) {
        const query = cursor === null
            ? `?limit=${NODES_PAGE_LIMIT}`
            : `?limit=${NODES_PAGE_LIMIT}&cursor=${cursor}`;

        const response = await apiService.get<{ data?: TaxiNode[]; pageInfo?: NodesPageInfo } | TaxiNode[]>(
            `/api/navigation/taxi/contributions/nodes${query}`
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch nodes');
        }

        const body = response.data as any;
        const items: TaxiNode[] = Array.isArray(body) ? body : body.data || [];
        nodes.push(...items);

        const pageInfo: NodesPageInfo | undefined = Array.isArray(body) ? undefined : body.pageInfo;
        if (!pageInfo?.hasMore || pageInfo.nextCursor == null) break;
        cursor = pageInfo.nextCursor;
    }

    return nodes;
}

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

    async getNodes(): Promise<TaxiNode[]> {
        return fetchAllContributionNodes();
    },

    async getAllNodes(): Promise<TaxiNode[]> {
        return fetchAllContributionNodes();
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
        const response = await apiService.post<any>(
            '/api/navigation/taxi/availability-windows',
            data
        );

        if (response.error) {
            const errorMsg = response.message || response.error || 'failed to create availability window';
            throw new Error(errorMsg);
        }

        if (!response.data) {
            throw new Error('failed to create availability window - no data returned');
        }

        const result = response.data.data || response.data;
        return result;
    },

    async createRoute(data: CreateTaxiRouteRequest): Promise<TaxiRoute> {
        const response = await apiService.post<{ data: TaxiRoute }>(
            '/api/taxi/routes',
            data
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to create route');
        }

        return response.data.data;
    },

    async getNodesForRoute(): Promise<TaxiNode[]> {
        const response = await apiService.get<TaxiNode[]>(
            '/api/taxi/nodes'
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'failed to fetch nodes for route');
        }

        return response.data;
    },

    async createNodeForRoute(data: { name: string; lat: number; lng: number; nodeType?: string; routeName?: string; landmark?: string }): Promise<TaxiNode> {
        const response = await apiService.post<any>(
            '/api/taxi/nodes',
            data
        );

        if (response.error) {
            throw new Error(response.status ? `${response.error} (HTTP ${response.status})` : response.error);
        }

        if (!response.data) {
            throw new Error('failed to create node - no data returned');
        }

        const result = response.data.data || response.data;
        return result;
    },

    async addStopToRoute(routeId: number, data: CreateTaxiRouteStopRequest): Promise<TaxiRouteStop> {
        const response = await apiService.post<any>(
            `/api/taxi/routes/${routeId}/stops`,
            data
        );

        if (response.error) {
            throw new Error(response.error);
        }

        if (!response.data) {
            throw new Error('failed to add stop to route - no data returned');
        }

        const result = response.data.data || response.data;
        return result;
    },
};
