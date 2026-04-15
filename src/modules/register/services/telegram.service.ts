import { apiService } from '../../../shared/services/api';
import { TelegramAuthPayload, TelegramAuthResponse } from '../types/telegram.types';

export const telegramService = {
    async loginWithTelegram(payload: TelegramAuthPayload) {
        return apiService.post<TelegramAuthResponse>('/api/users/telegram/login', payload);
    },
};
