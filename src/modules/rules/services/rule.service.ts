import { apiService } from '../../../shared/services/api';
import { TrafficRuleType, TrafficRuleReport, TrafficRuleReportRequest } from '../types/rule.types';

export const ruleService = {
    async getRuleTypes(): Promise<TrafficRuleType[]> {
        const response = await apiService.get<TrafficRuleType[]>('/api/rules/types');
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data || [];
    },

    async reportRule(data: TrafficRuleReportRequest): Promise<TrafficRuleReport> {
        const response = await apiService.post<TrafficRuleReport>('/api/rules/reports', data);
        if (response.error) {
            throw new Error(response.error);
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
