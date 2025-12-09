import { apiService } from '../../../shared/services/api';
import { Incident, IncidentReportRequest, INCIDENT_TYPE_BACKEND_MAP, IncidentType } from '../types/incident.types';

// Reverse mapping: backend enum to frontend type
const BACKEND_TO_FRONTEND_MAP: Record<string, IncidentType> = {
    'ACCIDENT': 'accident',
    'TRAFFIC_JAM': 'traffic',
    'ROAD_CLOSURE': 'closure',
    'HAZARD': 'hazard',
    'TRAFFIC_POLICE': 'police',
    'CONSTRUCTION': 'other',
    'BREAKDOWN': 'other',
    'CRASH': 'crash',
    'BAD_WEATHER': 'weather',
    'BROKEN_ROAD': 'broken-road',
    'OTHER': 'other',
};

export const incidentService = {
    async report(data: IncidentReportRequest) {
        //converting to enum
        const backendData = {
            ...data,
            type: INCIDENT_TYPE_BACKEND_MAP[data.type],
        };

        return apiService.post<Incident>('/api/incidents/report', backendData);
    },

    async getIncidents() {
        const response = await apiService.get<any[]>('/api/incidents');

        if (response.error || !response.data) {
            return response as any;
        }

        //backend type to frontend type (for the icons)
        const incidents: Incident[] = response.data.map((incident) => ({
            ...incident,
            type: BACKEND_TO_FRONTEND_MAP[incident.type] || 'other',
        }));

        return { data: incidents };
    },
};
