export interface GeocodingPlace {
    name: string;
    latitude: number;
    longitude: number;
    Country: string;
    City: string;
    type: string;
    image?: string;
}

export interface GeocodingResponse {
    msg: string;
    data: GeocodingPlace[];
}

export interface NavigationRequest {
    origin: [number, number];
    destination: [number, number];
}

export interface Maneuver {
    type: number;
    instruction: string;
    verbal_succinct_transition_instruction: string;
    verbal_pre_transition_instruction: string;
    verbal_post_transition_instruction: string;
    bearing_after: number;
    time: number;
    length: number;
    cost: number;
    begin_shape_index: number;
    end_shape_index: number;
    travel_mode: string;
    travel_type: string;
}

export interface LegSummary {
    has_time_restrictions: boolean;
    has_toll: boolean;
    has_highway: boolean;
    has_ferry: boolean;
    min_lat: number;
    min_lon: number;
    max_lat: number;
    max_lon: number;
    time: number;
    length: number;
    cost: number;
}

export interface Leg {
    maneuvers: Maneuver[];
    summary: LegSummary;
    shape: string;
}

export interface TripLocation {
    type: string;
    lat: number;
    lon: number;
    original_index: number;
}

export interface Trip {
    locations: TripLocation[];
    legs: Leg[];
    summary: LegSummary;
    status_message: string;
    status: number;
    units: string;
    language: string;
}

export interface NavigationResponse {
    data: {
        trip: Trip;
    };
}
