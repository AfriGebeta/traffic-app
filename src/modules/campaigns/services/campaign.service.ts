import { apiService } from '../../../shared/services/api';
import { ApiError } from '../../../shared/utils/apiErrors';
import { Campaign, CampaignKind, CampaignLeaderboard, CampaignMe, CampaignPeriodKind, MySubmissions } from '../types/campaign.types';

const unwrap = <T>(body: any): T => (body && typeof body === 'object' && 'data' in body ? body.data : body);

export const campaignService = {
    async getRunning(): Promise<Campaign[]> {
        const response = await apiService.get<{ data: Campaign[] }>('/api/campaigns/running');
        console.log('[campaigns] running raw', JSON.stringify(response.data ?? response.error));
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load campaigns');
        const campaigns = unwrap<Campaign[]>(response.data);
        return Array.isArray(campaigns) ? campaigns : [];
    },

    async getMe(slug: string): Promise<CampaignMe> {
        const response = await apiService.get<CampaignMe>(`/api/campaigns/${encodeURIComponent(slug)}/me`);
        console.log('[campaigns] me raw', slug, JSON.stringify(response.data ?? response.error));
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load campaign standing');
        return unwrap<CampaignMe>(response.data);
    },

    async join(slug: string, track?: string | null): Promise<{ track?: string | null; joinedAt: string }> {
        const response = await apiService.post<{ data: { track?: string | null; joinedAt: string } }>(
            `/api/campaigns/${encodeURIComponent(slug)}/join`,
            track ? { track } : {}
        );
        if (response.error || !response.data) throw new ApiError(response, 'Failed to join campaign');
        return unwrap(response.data);
    },

    async getMySubmissions(params: { page?: number; kind?: CampaignKind; campaign?: string } = {}): Promise<MySubmissions> {
        const query = new URLSearchParams({ page: String(params.page ?? 1) });
        if (params.kind) query.set('kind', params.kind);
        if (params.campaign) query.set('campaign', params.campaign);
        const response = await apiService.get<MySubmissions>(`/api/submissions/mine?${query.toString()}`);
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load contributions');
        return response.data;
    },

    // testing only: points earned before leaving stop counting
    async leave(slug: string): Promise<void> {
        const response = await apiService.post(`/api/campaigns/${encodeURIComponent(slug)}/leave`);
        if (response.error) throw new ApiError(response, 'Failed to leave campaign');
    },

    async getLeaderboard(slug: string, track: string | null, period: CampaignPeriodKind, key?: string): Promise<CampaignLeaderboard> {
        const params = new URLSearchParams({ period });
        if (track) params.set('track', track);
        if (key) params.set('key', key);
        const response = await apiService.get<CampaignLeaderboard>(
            `/api/campaigns/${encodeURIComponent(slug)}/leaderboard?${params.toString()}`
        );
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load leaderboard');
        return response.data;
    },
};
