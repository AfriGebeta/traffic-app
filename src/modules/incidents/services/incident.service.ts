import { apiService } from '../../../shared/services/api';
import { Incident, IncidentReportRequest, IncidentTypeFromAPI } from '../types/incident.types';

export const incidentService = {
    async getIncidentTypes() {
        return apiService.get<IncidentTypeFromAPI[]>('/api/incidents/types');
    },

    async report(data: IncidentReportRequest) {
        return apiService.post<Incident>('/api/incidents/report', data);
    },

    async getIncidents() {
        return apiService.get<Incident[]>('/api/incidents');
    },
};
