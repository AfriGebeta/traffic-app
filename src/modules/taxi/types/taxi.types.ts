export interface TaxiNode {
    id: number;
    name: string;
    lat: number;
    lng: number;
    nodeType?: 'station' | 'stop';
    routeName?: string;
}

export interface TaxiEdge {
    id: number;
    start_node_id: number;
    end_node_id: number;
    cost: number;
    connection?: 'taxi' | 'walk';
    start_node?: TaxiNode;
    end_node?: TaxiNode;
}

export interface CreateTaxiNodeRequest {
    name: string;
    lat: number;
    lng: number;
    nodeType?: 'station' | 'stop';
    routeName?: string;
}

export interface CreateTaxiEdgeRequest {
    startNodeId: number;
    endNodeId: number;
    cost: number;
    connection?: 'taxi' | 'walk';
}
