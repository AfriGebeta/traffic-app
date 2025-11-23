import { apiService } from '../../../shared/services/api';
import { Incident, IncidentReportRequest } from '../types/incident.types';

export const incidentService = {
    async report(data: IncidentReportRequest) {
        return apiService.post<Incident>('/api/incidents/report', data);
    },
};
