import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppCheckToken } from '../../../shared/utils/appCheck';
import { cacheAudioFile, getCachedAudioUri, storeAudioBytes } from '../../../shared/utils/audioFileCache';
import { resolveStorageUri } from '../../../shared/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const OBJECT_KEY_STORE = '@traffic_app_tts_object_keys';

export const ttsCacheKey = (text: string, language?: string, speaker_name?: string): string =>
    [text, language ?? '', speaker_name ?? ''].join('|');

type AudioSource = 'disk' | 'remote-cache' | 'stored-object' | 'synth';

const preview = (text: string): string => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

const logSource = (source: AudioSource, text: string, startedAt: number) => {
    console.log(`[tts] ${source} (${Date.now() - startedAt}ms) "${text}"`);
};

let objectKeys: Record<string, string> | null = null;
let objectKeysLoad: Promise<Record<string, string>> | null = null;

const loadObjectKeys = (): Promise<Record<string, string>> => {
    if (objectKeys) return Promise.resolve(objectKeys);
    if (objectKeysLoad) return objectKeysLoad;

    objectKeysLoad = AsyncStorage.getItem(OBJECT_KEY_STORE)
        .then((raw) => {
            objectKeys = raw ? (JSON.parse(raw) as Record<string, string>) : {};
            return objectKeys;
        })
        .catch(() => {
            objectKeys = {};
            return objectKeys;
        })
        .finally(() => {
            objectKeysLoad = null;
        });

    return objectKeysLoad;
};

const persistObjectKeys = async (map: Record<string, string>): Promise<void> => {
    try {
        await AsyncStorage.setItem(OBJECT_KEY_STORE, JSON.stringify(map));
    } catch (error) {
        console.error('[tts] could not persist object key:', error);
    }
};

const rememberObjectKey = async (cacheKey: string, objectKey: string): Promise<void> => {
    const map = await loadObjectKeys();
    if (map[cacheKey] === objectKey) return;
    map[cacheKey] = objectKey;
    await persistObjectKeys(map);
};

const forgetObjectKey = async (cacheKey: string): Promise<void> => {
    const map = await loadObjectKeys();
    if (!(cacheKey in map)) return;
    delete map[cacheKey];
    await persistObjectKeys(map);
};

const ETHIOPIC = /[ሀ-፿]/;

const decodeMeta = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
};
const objectMatchesText = async (
    signedUrl: string,
    text: string,
    language?: string
): Promise<boolean> => {
    try {
        const response = await fetch(signedUrl, { headers: { Range: 'bytes=0-0' } });
        const stored = decodeMeta(response.headers.get('x-amz-meta-original-text'));
        if (!stored) return true;

        if (stored.trim() !== text.trim()) {
            console.warn(`[tts] stored object holds different text: "${preview(stored)}"`);
            return false;
        }

        const spoken = decodeMeta(response.headers.get('x-amz-meta-english-text'));
        if (language === 'amh' && spoken && !ETHIOPIC.test(spoken)) {
            console.warn(`[tts] stored object was spoken in the wrong language: "${preview(spoken)}"`);
            return false;
        }

        return true;
    } catch {
        return true;
    }
};

const downloadObject = async (
    objectKey: string,
    cacheKey: string,
    text: string,
    language?: string
): Promise<{ uri: string | null; missing: boolean; mismatched?: boolean }> => {
    const signedUrl = await resolveStorageUri(objectKey);
    if (!signedUrl) return { uri: null, missing: false };

    if (!(await objectMatchesText(signedUrl, text, language))) {
        return { uri: null, missing: false, mismatched: true };
    }

    const result = await cacheAudioFile(signedUrl, cacheKey);
    if (result.uri !== null) return { uri: result.uri, missing: false };

    return { uri: null, missing: result.reason === 'missing' };
};

export interface TtsFetchOptions {
    shouldBeStored?: boolean;
}

export const fetchTtsAudioUri = async (
    text: string,
    language?: string,
    speaker_name?: string,
    options: TtsFetchOptions = {}
): Promise<string | null> => {
    const { shouldBeStored = true } = options;
    const startedAt = Date.now();
    const cacheKey = ttsCacheKey(text, language, speaker_name);

    const onDisk = getCachedAudioUri(cacheKey);
    if (onDisk) {
        logSource('disk', text, startedAt);
        return onDisk;
    }

    const storedObjectKey = (await loadObjectKeys())[cacheKey];
    if (storedObjectKey) {
        const stored = await downloadObject(storedObjectKey, cacheKey, text, language);
        if (stored.uri) {
            logSource('stored-object', text, startedAt);
            return stored.uri;
        }
        if (stored.missing || stored.mismatched) await forgetObjectKey(cacheKey);
    }

    const appCheckToken = await getAppCheckToken();

    const callSynthesize = (store: boolean) =>
        fetch(`${API_URL}/api/asr/tts/synthesize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
            },
            body: JSON.stringify({
                text,
                ...(language ? { language } : {}),
                ...(speaker_name ? { speaker_name } : {}),
                shouldBeStored: store,
            }),
        });

    let response = await callSynthesize(shouldBeStored);

    if (response.status >= 500) {
        response = await callSynthesize(false);
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`[tts] synthesize failed: ${response.status} ${detail.slice(0, 200)}`);
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

        if (!(await objectMatchesText(signedUrl, text, language))) {
            if (shouldBeStored !== false) {
                return fetchTtsAudioUri(text, language, speaker_name, {
                    ...options,
                    shouldBeStored: false,
                });
            }
            return null;
        }

        const result = await cacheAudioFile(signedUrl, cacheKey);
        if (result.uri !== null) {
            await rememberObjectKey(cacheKey, url);
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
