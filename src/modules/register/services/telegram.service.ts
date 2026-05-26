import { apiService } from '../../../shared/services/api';
import { TelegramAuthPayload, TelegramAuthResponse } from '../types/telegram.types';
import { telegramAuthLog } from '../../../shared/utils/telegram-auth-logger';

export const telegramService = {
    async loginWithTelegram(payload: TelegramAuthPayload) {
        telegramAuthLog.info('POST /api/users/telegram/login', {
            hasIdToken: !!payload.id_token,
            idTokenPreview: `${payload.id_token.slice(0, 12)}... (${payload.id_token.length} chars)`,
        });

        const response = await apiService.post<TelegramAuthResponse>('/api/users/telegram/login', payload);

        telegramAuthLog.info('POST /api/users/telegram/login response', {
            hasData: !!response.data,
            hasError: !!response.error,
            message: response.message,
        });

        return response;
    },
};
