import axios from 'axios';
import { CreateTaxiNodeRequest, CreateTaxiEdgeRequest, TaxiNode, TaxiEdge } from '../types/taxi.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ;

export const taxiService = {
    async createNode(data: CreateTaxiNodeRequest): Promise<TaxiNode> {
        const response = await axios.post(
            `${API_URL}/api/navigation/taxi/contributions/nodes`,
            data
        );
        return response.data;
    },

    async getNodes(limit: number = 100): Promise<TaxiNode[]> {
        const response = await axios.get(
            `${API_URL}/api/navigation/taxi/contributions/nodes`,
            { params: { limit } }
        );
        return response.data;
    },

    async createEdge(data: CreateTaxiEdgeRequest): Promise<TaxiEdge> {
        const response = await axios.post(
            `${API_URL}/api/navigation/taxi/contributions/edges`,
            data
        );
        return response.data;
    },

    async getEdges(limit: number = 100): Promise<TaxiEdge[]> {
        const response = await axios.get(
            `${API_URL}/api/navigation/taxi/contributions/edges`,
            { params: { limit } }
        );
        return response.data;
    },
};
