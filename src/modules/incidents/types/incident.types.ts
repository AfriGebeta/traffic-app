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

export type IncidentType = 'police' | 'traffic' | 'crash' | 'closure' | 'hazard' | 'weather';

export const INCIDENT_TYPES = [
    { id: 'police', label: 'Police', icon: 'shield-checkmark' as const, color: '#3B82F6' },
    { id: 'traffic', label: 'Traffic', icon: 'car' as const, color: '#EF4444' },
    { id: 'crash', label: 'Crash', icon: 'warning' as const, color: '#F59E0B' },
    { id: 'closure', label: 'Closure', icon: 'close-circle' as const, color: '#8B5CF6' },
    { id: 'hazard', label: 'Hazard', icon: 'alert-circle' as const, color: '#EC4899' },
    { id: 'weather', label: 'Bad Weather', icon: 'rainy' as const, color: '#6B7280' },
] as const;
