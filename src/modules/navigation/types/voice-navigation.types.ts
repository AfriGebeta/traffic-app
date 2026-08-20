import type { TaxiNavigationResponse } from '../../taxi/types/taxi.types';

export interface VoiceNavigationRequest {
    audio: File | Blob;
    translate: boolean;
    language: string;
    originLat?: number;
    originLng?: number;
}

export interface VoiceNavigationEntity {
    destination: string[];
    location: string[];
    origin: string[];
}

export interface NavigationLocation {
    latitude: number;
    longitude: number;
    name: string;
}

export interface NavigationDestination extends NavigationLocation {
    Country: string;
    City: string;
    type: string;
}

export interface RouteManeuver {
    type: number;
    instruction: string;
    verbal_succinct_transition_instruction: string;
    verbal_pre_transition_instruction: string;
    verbal_post_transition_instruction: string;
    bearing_after: number;
    bearing_before?: number;
    time: number;
    length: number;
    cost: number;
    begin_shape_index: number;
    end_shape_index: number;
    travel_mode: string;
    travel_type: string;
}

export interface RouteSummary {
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

export interface RouteLeg {
    maneuvers: RouteManeuver[];
    summary: RouteSummary;
    shape: string;
}

export interface TripLocation {
    type: string;
    lat: number;
    lon: number;
    original_index: number;
}

export interface RouteTrip {
    locations: TripLocation[];
    legs: RouteLeg[];
    summary: RouteSummary;
    status_message: string;
    status: number;
    units: string;
    language: string;
}

export interface NavigationOption {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

export interface TaxiPlan {
    narrative: string;
    message: string;
    route: TaxiNavigationResponse;
    started: boolean;
}

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant' | 'options' | 'taxi' | 'places';
    text: string;
    options?: NavigationOption[];
    taxiPlan?: TaxiPlan;
}

export interface VoiceNavigationData {
    origin: NavigationLocation | null;
    destination: NavigationDestination | null;
    route: {
        trip: RouteTrip;
    } | null;
    message?: string;
    requiresConfirmation?: boolean;
    options?: NavigationOption[];
}

export interface VoiceNavigationResponse {
    success: boolean;
    transcription: string;
    entities?: VoiceNavigationEntity;
    navigationData: VoiceNavigationData;
    message?: string | null;
    metadata?: {
        tokens_charged: number;
        remaining_tokens: number;
        charge_message: string;
    };
}
