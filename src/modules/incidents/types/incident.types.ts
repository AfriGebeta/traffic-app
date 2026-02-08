export interface IncidentTypeFromAPI {
    id: string;
    name: string;
    label: string;
    icon: string | null;
    defaultRadius: number;
    defaultDuration: number;
    severity: number;
    createdAt: string;
    updatedAt: string;
}

export interface Incident {
    id: string;
    lat: number;
    lng: number;
    type: IncidentTypeFromAPI;
    description: string;
    direction?: string;
    confirmed: boolean;
    createdAt: string;
    upvotes: number;
    downvotes: number;
}

export interface IncidentReportRequest {
    lat: number;
    lng: number;
    type: string;
    description: string;
    direction?: string;
    images?: string[];
}

export const INCIDENT_TYPES = [
    { name: 'ROAD_CLOSURE', label: 'Road Closure', icon: 'close-circle' as const, color: '#8B5CF6' },
    { name: 'ACCIDENT', label: 'Accident', icon: 'nuclear' as const, color: '#F59E0B' },
    { name: 'TRAFFIC_JAM', label: 'Traffic Jam', icon: 'car' as const, color: '#EF4444' },
    { name: 'BAD_WEATHER', label: 'Bad Weather', icon: 'rainy' as const, color: '#3B82F6' },
    { name: 'HAZARD', label: 'Hazard', icon: 'warning' as const, color: '#F59E0B' },
    { name: 'CRASH', label: 'Crash', icon: 'car-sport' as const, color: '#EF4444' },
    { name: 'GATED_COMMUNITY', label: 'Gated Community', icon: 'home' as const, color: '#10B981' },
    { name: 'BROKEN_ROAD', label: 'Broken Road', icon: 'alert-circle' as const, color: '#EF4444' },
    { name: 'OTHER', label: 'Other', icon: 'apps-outline' as const, color: '#F97316' },
] as const;


export const INCIDENT_ICON_MAP: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
    'ROAD_CLOSURE': 'close-circle',
    'ACCIDENT': 'nuclear',
    'TRAFFIC_JAM': 'car',
    'BAD_WEATHER': 'rainy',
    'HAZARD': 'warning',
    'CRASH': 'car-sport',
    'GATED_COMMUNITY': 'home',
    'BROKEN_ROAD': 'alert-circle',
    'OTHER': 'apps-outline',
};

export const INCIDENT_COLOR_MAP: Record<string, string> = {
    'ROAD_CLOSURE': '#8B5CF6',
    'ACCIDENT': '#F59E0B',
    'TRAFFIC_JAM': '#EF4444',
    'BAD_WEATHER': '#3B82F6',
    'HAZARD': '#F59E0B',
    'CRASH': '#EF4444',
    'GATED_COMMUNITY': '#10B981',
    'BROKEN_ROAD': '#EF4444',
    'OTHER': '#F97316',
};
