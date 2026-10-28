import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { apiService, ApiResponse } from '../../../shared/services/api';

export type SupportCategory = 'bug' | 'feature';

export interface SupportRequest {
    category: SupportCategory;
    message: string;
    locale: string;
}

const deviceModel = [Device.brand, Device.modelName].filter(Boolean).join(' ').trim();

class SupportService {
    async submit({ category, message, locale }: SupportRequest): Promise<ApiResponse<unknown>> {
        return apiService.post('/api/support', {
            category,
            message,
            appVersion: Application.nativeApplicationVersion ?? undefined,
            deviceInfo: {
                platform: Platform.OS,
                osVersion: Device.osVersion ?? undefined,
                model: deviceModel || undefined,
                locale,
            },
        });
    }
}

export const supportService = new SupportService();
