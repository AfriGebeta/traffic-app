import { apiService } from '../../../shared/services/api';
import { Incident, IncidentReportRequest, IncidentTypeFromAPI } from '../types/incident.types';

export const incidentService = {
    async getIncidentTypes() {
        return apiService.get<IncidentTypeFromAPI[]>('/api/incidents/types');
    },

    async report(data: IncidentReportRequest) {
        return apiService.post<Incident>('/api/incidents/report', data);
    },

    async getIncidents(filters?: string[]) {
        let url = '/api/incidents';
        if (filters && filters.length > 0) {
            const filterParams = filters.map(f => `filter=${f}`).join('&');
            url = `${url}?${filterParams}`;
        }
        return apiService.get<Incident[]>(url);
    },

    async upvote(incidentId: string) {
        return apiService.post<void>(`/api/incidents/${incidentId}/upvote`);
    },

    async downvote(incidentId: string) {
        return apiService.post<void>(`/api/incidents/${incidentId}/downvote`);
    },
};
