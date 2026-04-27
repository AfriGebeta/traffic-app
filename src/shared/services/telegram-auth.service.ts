import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { telegramService } from '../../modules/register/services/telegram.service';
import { TelegramAuthPayload } from '../../modules/register/types/telegram.types';

const TOKEN_STORAGE_KEY = '@traffic_app_token';
const USER_STORAGE_KEY = '@traffic_app_user';

class TelegramAuthService {
    async handleCallback(url: string): Promise<boolean> {
        try {
            console.log('TelegramAuthService - Handling callback URL:', url);

            const { queryParams } = Linking.parse(url);
            console.log('TelegramAuthService - Parsed params:', queryParams);

            if (!queryParams?.id || !queryParams?.hash) {
                console.error('TelegramAuthService - Missing required params (id or hash)');
                throw new Error('Invalid Telegram payload');
            }

            const payload: TelegramAuthPayload = {
                id: String(queryParams.id),
                auth_date: String(queryParams.auth_date),
                hash: String(queryParams.hash),
                first_name: String(queryParams.first_name ?? ''),
                username: queryParams.username ? String(queryParams.username) : undefined,
                photo_url: queryParams.photo_url ? String(queryParams.photo_url) : undefined,
            };

            console.log('TelegramAuthService - Sending payload to API:', payload);

            const response = await telegramService.loginWithTelegram(payload);
            console.log('TelegramAuthService - API response:', response);


            if (response.data) {
                // Store both token and user data
                await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);

                // Store user data
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));

                console.log('TelegramAuthService - Auth successful, data stored');
                return true;
            }

            console.error('TelegramAuthService - No data in response');
            return false;
        } catch (error) {
            console.error('TelegramAuthService - Error:', error);
            return false;
        }
    }
}

export default new TelegramAuthService();
