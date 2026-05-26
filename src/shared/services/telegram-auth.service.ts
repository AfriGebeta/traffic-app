import AsyncStorage from '@react-native-async-storage/async-storage';
import { telegramService } from '../../modules/register/services/telegram.service';
import {
    extractIdTokenFromUrl,
    extractLegacyTelegramParams,
    extractTelegramAuthErrorFromUrl,
} from '../utils/telegram-auth-url';
import { telegramAuthLog } from '../utils/telegram-auth-logger';

const TOKEN_STORAGE_KEY = '@traffic_app_token';
const USER_STORAGE_KEY = '@traffic_app_user';

class TelegramAuthService {
    private async storeAuthResponse(
        response: Awaited<ReturnType<typeof telegramService.loginWithTelegram>>
    ): Promise<boolean> {
        telegramAuthLog.info('backend response received', {
            hasData: !!response.data,
            hasError: !!response.error,
            message: response.message,
            userId: response.data?.user?.id,
            hasToken: !!response.data?.token,
        });

        if (!response.data) {
            return false;
        }

        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));

        telegramAuthLog.info('session stored in AsyncStorage');
        return true;
    }

    async loginWithIdToken(idToken: string): Promise<boolean> {
        telegramAuthLog.info('loginWithIdToken called', {
            idTokenPreview: `${idToken.slice(0, 12)}... (${idToken.length} chars)`,
        });

        try {
            const response = await telegramService.loginWithTelegram({ id_token: idToken });
            return this.storeAuthResponse(response);
        } catch (error) {
            telegramAuthLog.error('loginWithIdToken failed', error);
            return false;
        }
    }

    async handleAuthRedirect(url: string): Promise<{ success: boolean; error?: string }> {
        telegramAuthLog.url('handleAuthRedirect', url);

        const authError = extractTelegramAuthErrorFromUrl(url);
        if (authError) {
            telegramAuthLog.warn('auth error found in redirect URL', { authError });
            return { success: false, error: authError };
        }

        const legacyParams = extractLegacyTelegramParams(url);
        if (legacyParams) {
            telegramAuthLog.warn('legacy Telegram params detected (id/hash), backend expects id_token', legacyParams);
        }

        const idToken = extractIdTokenFromUrl(url);
        if (!idToken) {
            telegramAuthLog.warn('no id_token found in redirect URL');
            return { success: false };
        }

        const success = await this.loginWithIdToken(idToken);
        return success ? { success: true } : { success: false, error: 'Telegram authentication failed' };
    }

    async handleCallback(url: string): Promise<boolean> {
        const result = await this.handleAuthRedirect(url);
        return result.success;
    }
}

export default new TelegramAuthService();
