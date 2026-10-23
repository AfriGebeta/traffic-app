import { apiService } from '../../../shared/services/api';
import { ApiError } from '../../../shared/utils/apiErrors';
import { DeviceFields, getDeviceFields } from '../../../shared/utils/deviceFields';
import { TrafficRuleType, TrafficRuleReport, TrafficRuleReportRequest } from '../types/rule.types';

export const ruleService = {
    // backend rejects votes from more than 300 m away, so the voter's location is required
    async upvote(reportId: string, location: { lat: number; lng: number }): Promise<TrafficRuleReport> {
        return ruleService.vote(reportId, 'upvote', location);
    },

    async downvote(reportId: string, location: { lat: number; lng: number }): Promise<TrafficRuleReport> {
        return ruleService.vote(reportId, 'downvote', location);
    },

    async vote(
        reportId: string,
        direction: 'upvote' | 'downvote',
        location: { lat: number; lng: number }
    ): Promise<TrafficRuleReport> {
        const response = await apiService.post<TrafficRuleReport>(`/api/rules/reports/${reportId}/${direction}`, location);
        if (response.error || !response.data) {
            throw new ApiError(response, 'Failed to vote');
        }
        return response.data;
    },

    async getRuleTypes(): Promise<TrafficRuleType[]> {
        const response = await apiService.get<TrafficRuleType[]>('/api/rules/types');
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data || [];
    },

    async reportRule(data: TrafficRuleReportRequest & DeviceFields): Promise<TrafficRuleReport> {
        const response = await apiService.post<TrafficRuleReport>('/api/rules/reports', { ...(await getDeviceFields()), ...data });
        if (response.error) {
            throw new ApiError(response);
        }
        if (!response.data) {
            throw new Error('No data returned from server');
        }
        return response.data;
    },

    async getAllReports(): Promise<TrafficRuleReport[]> {
        const response = await apiService.get<TrafficRuleReport[]>('/api/rules/reports');
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data || [];
    },

    async getNearbyReports(lat: number, lng: number, radius: number = 100): Promise<TrafficRuleReport[]> {
        const response = await apiService.get<TrafficRuleReport[]>(
            `/api/rules/reports/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
        );
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data || [];
    },

    async getReportById(reportId: string): Promise<TrafficRuleReport> {
        const response = await apiService.get<TrafficRuleReport>(`/api/rules/reports/${reportId}`);
        if (response.error) {
            throw new Error(response.error);
        }
        if (!response.data) {
            throw new Error('Report not found');
        }
        return response.data;
    },
};
