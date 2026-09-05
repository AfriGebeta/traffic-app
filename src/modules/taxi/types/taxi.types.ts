export interface TaxiNode {
    id: number;
    name: string;
    lat: number;
    lng: number;
    nodeType?: 'station' | 'stop';
    routeName?: string;
    landmark?: string;
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
    landmark?: string;
}

export interface TaxiRoute {
    id: number;
    name: string;
    color: string;
    type: 'minibus' | 'taxi';
    geometry?: any;
    isActive: boolean;
    stops?: TaxiRouteStop[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaxiRouteRequest {
    name: string;
    color: string;
    type: 'minibus' | 'taxi';
}

export interface TaxiRouteStop {
    id: number;
    routeId: number;
    nodeId: number;
    sequenceIndex: number;
    fareFromStart: number;
    distanceFromStart?: number;
    node?: {
        id: number;
        name: string;
        lat: number;
        lng: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaxiRouteStopRequest {
    nodeId: number;
    fareFromStart: number;
}

export interface CreateTaxiEdgeRequest {
    startNodeId: number;
    endNodeId: number;
    cost: number;
    connection?: 'taxi' | 'walk';
}

export interface TaxiNavigationRequest {
    origin?: [number, number];
    destination?: [number, number];
    originName?: string;
    destinationName?: string;
    at?: string;
}

export interface WalkManeuver {
    type: number;
    instruction: string;
    verbal_pre_transition_instruction: string;
    bearing_after: number;
    bearing_before?: number;
    time: number;
    length: number;
    cost: number;
}

export interface WalkLeg {
    maneuvers: WalkManeuver[];
    summary: {
        time: number;
        length: number;
        cost: number;
    };
    shape: string;
}

export interface WalkRoute {
    trip: {
        locations: Array<{
            type: string;
            lat: number;
            lon: number;
        }>;
        legs: WalkLeg[];
        summary: {
            time: number;
            length: number;
            cost: number;
        };
    };
}

export interface RouteSegment {
    routeId?: number;
    type: 'walk' | 'taxi';
    mode: 'pedestrian' | 'auto';
    distance: number;
    time: number;
    polyline: string;
    overrideCoords?: [number, number][];
    fare?: number;
    from: {
        lat: number;
        lng: number;
    };
    to: {
        lat: number;
        lng: number;
    };
    fromNode?: TaxiNode;
    toNode?: TaxiNode;
    instructions?: any[];
}

export interface TaxiNavigationResponse {
    success: boolean;
    timestamp: string;
    planId?: number;
    origin: {
        lat: number;
        lng: number;
    };
    destination: {
        lat: number;
        lng: number;
    };
    startNode: {
        id: number;
        nodeType?: string;
        node_type?: string;
        route_name?: string;
        name: string;
        lat: number;
        lng: number;
    };
    endNode: {
        id: number;
        nodeType?: string;
        node_type?: string;
        route_name?: string;
        name: string;
        lat: number;
        lng: number;
    };
    path: number[];
    formattedPath: string;
    segments?: RouteSegment[];
    originWalkRoute?: WalkRoute;
    destinationWalkRoute?: WalkRoute;
    summary: {
        totalNodes: number;
        taxiSegments: number;
        walkSegments: number;
        estimatedFare: number;
        currency: string;
        pricingSource: string;
    };
}

export interface AvailabilityWindow {
    routeId: number;
    dayOfWeek: number | null;
    startMinutes: number;
    endMinutes: number;
    isAvailable: boolean;
}

export interface CreateAvailabilityWindowRequest {
    routeId: number;
    dayOfWeek: number | null;
    startMinutes: number;
    endMinutes: number;
    isAvailable: boolean;
}

export type NavigationMode = 'driving' | 'taxi';
export type SegmentMode = 'walk' | 'taxi' | 'auto' | 'pedestrian';

export interface TaxiNavigationData {
    mode: 'taxi';
    segments: RouteSegment[];
    currentSegmentIndex: number;
    startNode: TaxiNode;
    endNode: TaxiNode;
    totalFare: number;
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    fullRoute: TaxiNavigationResponse;
}

export interface SegmentTransitionEvent {
    fromSegment: RouteSegment;
    toSegment: RouteSegment;
    segmentIndex: number;
    totalSegments: number;
}
