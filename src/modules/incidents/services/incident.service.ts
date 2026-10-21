import { apiService } from '../../../shared/services/api';
import { DeviceFields, getDeviceFields } from '../../../shared/utils/deviceFields';
import { Incident, IncidentReportRequest, IncidentTypeFromAPI } from '../types/incident.types';

export const incidentService = {
    async getIncidentTypes() {
        return apiService.get<IncidentTypeFromAPI[]>('/api/incidents/types');
    },

    // device fields the caller passes (e.g. from the photo's fix) win over the last-known location
    async report(data: IncidentReportRequest & DeviceFields) {
        return apiService.post<Incident>('/api/incidents/report', { ...(await getDeviceFields()), ...data });
    },

    async getIncidents(filters?: string[]) {
        let url = '/api/incidents';
        if (filters && filters.length > 0) {
            const filterParams = filters.map(f => `filter=${f}`).join('&');
            url = `${url}?${filterParams}`;
        }
        return apiService.get<Incident[]>(url);
    },

    // backend rejects votes from more than 300 m away, so the voter's location is required
    async upvote(incidentId: string, location: { lat: number; lng: number }) {
        return apiService.post<Incident>(`/api/incidents/${incidentId}/upvote`, location);
    },

    async downvote(incidentId: string, location: { lat: number; lng: number }) {
        return apiService.post<Incident>(`/api/incidents/${incidentId}/downvote`, location);
    },
};
