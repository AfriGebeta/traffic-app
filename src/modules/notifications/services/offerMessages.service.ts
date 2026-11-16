import { apiService } from '../../../shared/services/api';
import { ApiError } from '../../../shared/utils/apiErrors';

export interface OfferNotificationSettings {
    nearby: boolean;
    following: boolean;
    savedEnding: boolean;
    weekly: boolean;
    perDay: 1 | 2 | 3;
}

const unwrap = <T>(body: any): T => (body && typeof body === 'object' && 'data' in body ? body.data : body);

export const offerMessagesService = {
    async getSettings(): Promise<OfferNotificationSettings> {
        const response = await apiService.get('/api/users/offer-notifications');
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load settings');
        return unwrap<OfferNotificationSettings>(response.data);
    },

    async saveSettings(changes: Partial<OfferNotificationSettings>): Promise<OfferNotificationSettings> {
        const response = await apiService.put('/api/users/offer-notifications', changes);
        if (response.error || !response.data) throw new ApiError(response, 'Failed to save settings');
        return unwrap<OfferNotificationSettings>(response.data);
    },
};
