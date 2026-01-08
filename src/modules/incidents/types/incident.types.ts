export interface Incident {
    id: string;
    lat: number;
    lng: number;
    type: IncidentType;
    description: string;
    confirmed: boolean;
    createdAt: string;
}

export interface IncidentReportRequest {
    lat: number;
    lng: number;
    type: IncidentType;
    description: string;
}


export type IncidentType = 'police' | 'traffic_jam' | 'crash' | 'closure' | 'speed_bump' | 'pot_hole' | 'flooding' | 'accident' | 'gated_community' | 'other';

export const INCIDENT_TYPE_BACKEND_MAP: Record<IncidentType, string> = {
    'accident': 'ACCIDENT',
    'traffic_jam': 'TRAFFIC_JAM',
    'closure': 'ROAD_CLOSURE',
    'speed_bump': 'SPEED_BUMP',
    'pot_hole': 'POT_HOLE',
    'police': 'TRAFFIC_POLICE',
    'crash': 'CRASH',
    'flooding': 'FLOODING',
    'gated_community': 'GATED_COMMUNITY',
    'other': 'OTHER',
};

export const INCIDENT_TYPES = [
    { id: 'police', label: 'Traffic Police', icon: 'shield-checkmark' as const, color: '#3B82F6' },
    { id: 'traffic_jam', label: 'Traffic Jam', icon: 'car' as const, color: '#EF4444' },
    { id: 'crash', label: 'Crash', icon: 'warning' as const, color: '#F59E0B' },
    { id: 'accident', label: 'Accident', icon: 'nuclear' as const, color: '#F59E0B' },
    { id: 'closure', label: 'Closure', icon: 'close-circle' as const, color: '#8B5CF6' },
    { id: 'speed_bump', label: 'Speed Bump', icon: 'triangle' as const, color: '#F59E0B' },
    { id: 'pot_hole', label: 'Pot Hole', icon: 'alert-circle' as const, color: '#EF4444' },
    { id: 'flooding', label: 'Flooding', icon: 'water' as const, color: '#3B82F6' },
    { id: 'gated_community', label: 'Gated Community', icon: 'home' as const, color: '#10B981' },
    { id: 'other', label: 'Other', icon: 'apps-outline' as const, color: '#F97316' },
] as const;
