import type { VoiceNavigationResponse } from '../types/voice-navigation.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export const voiceNavigationService = {
    async processVoiceNavigation(
        audioUri: string,
        language: string,
        originLat?: number,
        originLng?: number
    ): Promise<VoiceNavigationResponse | null> {
        try {
            console.log('Voice Navigation Request:', {
                audioUri,
                language,
                originLat,
                originLng,
                endpoint: `${API_URL}/api/asr/process-voice-navigation`
            });

            const formData = new FormData();

            const fileExtension = audioUri.split('.').pop() || 'm4a';
            const mimeType = fileExtension === 'm4a' ? 'audio/mp4' : 'audio/ogg';

            const audioFile = {
                uri: audioUri,
                type: mimeType,
                name: `audio.${fileExtension}`,
            } as any;
            formData.append('audio', audioFile);

            console.log('Audio file details:', {
                uri: audioUri,
                type: mimeType,
                name: `audio.${fileExtension}`
            });

            formData.append('translate', 'false');
            formData.append('language', language);

            if (originLat !== undefined && originLng !== undefined) {
                formData.append('originLat', originLat.toString());
                formData.append('originLng', originLng.toString());
            }

            const response = await fetch(`${API_URL}/api/asr/process-voice-navigation`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                },
            });

            console.log('Voice Navigation Response Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Voice navigation error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });

                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.details && typeof errorData.details === 'string') {
                        return {
                            success: false,
                            message: errorData.details,
                            transcription: '',
                            entities: { destination: [], location: [], origin: [] },
                            navigationData: null as any,
                            metadata: null as any,
                        };
                    }
                } catch (e) {
                    
                }

                return null;
            }

            const data = await response.json();
            console.log('Voice Navigation Success:', {
                success: data.success,
                transcription: data.transcription,
                hasNavigationData: !!data.navigationData
            });

            return data as VoiceNavigationResponse;
        } catch (error) {
            console.error('Voice navigation service error:', error);
            return null;
        }
    },
};
