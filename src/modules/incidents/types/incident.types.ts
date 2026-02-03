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
}

export interface IncidentReportRequest {
    lat: number;
    lng: number;
    typeId: string;
    description: string;
    direction?: string;
}

export const INCIDENT_TYPES = [
    { id: 'cmk4it3070000d8w0xdjkwdnk', name: 'TRAFFIC_POLICE', label: 'Traffic Police', icon: 'shield-checkmark' as const, color: '#3B82F6' },
    { id: 'cmk4it3070000d8w0xwoqerpiqw', name: 'CRASH', label: 'Crash', icon: 'warning' as const, color: '#F59E0B' },
    { id: 'cmk4it3070000d8w0xyyg881r', name: 'ACCIDENT', label: 'Accident', icon: 'nuclear' as const, color: '#F59E0B' },
    { id: 'cmk4it5kw0002d8w0d7b79b7j', name: 'ROAD_CLOSURE', label: 'Road Closure', icon: 'close-circle' as const, color: '#8B5CF6' },
    { id: 'cmk4it4jw0001d8w0vwd6mmv5', name: 'TRAFFIC_JAM', label: 'Traffic Jam', icon: 'car' as const, color: '#EF4444' },
    { id: 'cmk4it3070000d8w0cmsdnke', name: 'SPEED_BUMP', label: 'Speed Bump', icon: 'triangle' as const, color: '#F59E0B' },
    { id: 'cmk4it3070000d8wqmkwlnmlxw', name: 'POT_HOLE', label: 'Pot Hole', icon: 'alert-circle' as const, color: '#EF4444' },
    { id: 'cmk4it3070000d8wfwkelmf3', name: 'FLOODING', label: 'Flooding', icon: 'water' as const, color: '#3B82F6' },
    { id: 'cmk4it3070000d8wgatedcomm', name: 'GATED_COMMUNITY', label: 'Gated Community', icon: 'home' as const, color: '#10B981' },
    { id: 'cmk4it3070qpleowcmildqweioiomo', name: 'OTHER', label: 'Other', icon: 'apps-outline' as const, color: '#F97316' },
] as const;


export const INCIDENT_ICON_MAP: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
    'TRAFFIC_POLICE': 'shield-checkmark',
    'TRAFFIC_JAM': 'car',
    'CRASH': 'warning',
    'ACCIDENT': 'nuclear',
    'ROAD_CLOSURE': 'close-circle',
    'SPEED_BUMP': 'triangle',
    'POT_HOLE': 'alert-circle',
    'FLOODING': 'water',
    'GATED_COMMUNITY': 'home',
    'OTHER': 'apps-outline',
};

export const INCIDENT_COLOR_MAP: Record<string, string> = {
    'TRAFFIC_POLICE': '#3B82F6',
    'TRAFFIC_JAM': '#EF4444',
    'CRASH': '#F59E0B',
    'ACCIDENT': '#F59E0B',
    'ROAD_CLOSURE': '#8B5CF6',
    'SPEED_BUMP': '#F59E0B',
    'POT_HOLE': '#EF4444',
    'FLOODING': '#3B82F6',
    'GATED_COMMUNITY': '#10B981',
    'OTHER': '#F97316',
};
