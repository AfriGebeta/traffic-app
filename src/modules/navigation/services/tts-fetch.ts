import { getAppCheckToken } from '../../../shared/utils/appCheck';
import { cacheAudioFile, storeAudioBytes } from '../../../shared/utils/audioFileCache';
import { resolveStorageUri } from '../../../shared/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const cacheKeyFor = (text: string, language?: string, speaker_name?: string): string =>
    [text, language ?? '', speaker_name ?? ''].join('|');

type AudioSource = 'remote-cache' | 'synth';

const logSource = (source: AudioSource, text: string, startedAt: number) => {
    console.log(`[tts] ${source} (${Date.now() - startedAt}ms) "${text}"`);
};

export const fetchTtsAudioUri = async (
    text: string,
    language?: string,
    speaker_name?: string
): Promise<string | null> => {
    const startedAt = Date.now();
    const cacheKey = cacheKeyFor(text, language, speaker_name);

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

    if (!response.ok) {
        console.error('TTS request failed:', response.status);
        return null;
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
        const { url } = await response.json() as { url?: string };
        if (!url) {
            console.error('TTS response missing url');
            return null;
        }

        const signedUrl = await resolveStorageUri(url);
        if (!signedUrl) return null;

        const result = await cacheAudioFile(signedUrl, cacheKey);
        if (result.uri !== null) {
            logSource('remote-cache', text, startedAt);
            return result.uri;
        }

        if (result.reason === 'missing') {
            console.error(`TTS: no audio available for cue "${text}" — report this key to the backend`);
            return null;
        }

        console.warn(`[TTS] streaming fallback for "${text}" — download failed, playback may lag`);
        return signedUrl;
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) {
        console.error(`TTS: empty audio response for cue "${text}"`);
        return null;
    }

    const storedUri = storeAudioBytes(new Uint8Array(buffer), cacheKey);
    if (!storedUri) {
        console.error(`TTS: could not cache audio for cue "${text}"`);
        return null;
    }

    logSource('synth', text, startedAt);
    return storedUri;
};
