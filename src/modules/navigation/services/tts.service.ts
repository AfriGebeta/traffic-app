import { fetchTtsAudioUri } from './tts-fetch';

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
            return await fetchTtsAudioUri(text, language, speaker_name);
        } catch (error) {
            console.error('TTS service error:', error);
            return null;
        }
    },
};
