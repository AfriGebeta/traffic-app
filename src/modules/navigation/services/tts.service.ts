import { fetchTtsAudioUri, TtsFetchOptions } from './tts-fetch';

export interface TTSRequest {
    text: string;
    language?: string;
    speaker_name?: string;
}

export const ttsService = {
    async synthesizeSpeech(
        text: string,
        language?: string,
        speaker_name?: string,
        options?: TtsFetchOptions
    ): Promise<string | null> {
        try {
            return await fetchTtsAudioUri(text, language, speaker_name, options);
        } catch (error) {
            console.error('TTS service error:', error);
            return null;
        }
    },
};
