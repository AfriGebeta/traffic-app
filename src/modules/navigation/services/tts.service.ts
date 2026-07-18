import { getAppCheckToken } from '../../../shared/utils/appCheck';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export interface TTSRequest {
    text: string;
    language?: string;
    speaker_name?: string;
}

export const ttsService = {
    async synthesizeSpeech(
        text: string,
        language?: string,
        speaker_name?: string
    ): Promise<string | null> {
        try {
            console.log('TTS Request:', {
                text,
                language,
                speaker_name,
                endpoint: `${API_URL}/api/asr/tts/synthesize`
            });

            const appCheckToken = await getAppCheckToken();
            const response = await fetch(`${API_URL}/api/asr/tts/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
                },
                body: JSON.stringify({
                    text,
                    ...(language ? { language } : {}),
                    ...(speaker_name ? { speaker_name } : {}),
                }),
            });

            console.log('TTS Response Status:', response.status);

            if (!response.ok) {
                console.error('TTS request failed:', response.status);
                return null;
            }

            const blob = await response.blob();

            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    resolve(base64data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('TTS service error:', error);
            return null;
        }
    },
};
