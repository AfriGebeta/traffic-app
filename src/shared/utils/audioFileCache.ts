import { Directory, File, Paths } from 'expo-file-system';

const CACHE_DIR_NAME = 'tts-audio';

const toFileName = (key: string): string => {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
    }
    const slug = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    return `${slug}-${(hash >>> 0).toString(36)}`;
};

const getCacheDir = (): Directory => {
    const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
    if (!dir.exists) {
        dir.create({ intermediates: true });
    }
    return dir;
};

export const storeAudioBytes = (bytes: Uint8Array, cacheKey: string): string | null => {
    try {
        const target = new File(getCacheDir(), toFileName(cacheKey));
        if (target.exists) {
            target.delete();
        }
        target.create();
        target.write(bytes);
        return target.uri;
    } catch (error) {
        console.error('audio cache write error:', error);
        return null;
    }
};

export type AudioCacheResult =
    | { uri: string }
    | { uri: null; reason: 'missing' | 'failed' };

const isMissingObjectError = (error: unknown): boolean =>
    /status:\s*404/.test(error instanceof Error ? error.message : String(error));

const inFlight = new Map<string, Promise<AudioCacheResult>>();

let tempCounter = 0;

const download = async (remoteUrl: string, cacheKey: string): Promise<AudioCacheResult> => {
    const fileName = toFileName(cacheKey);
    const temp = new File(getCacheDir(), `${fileName}.${Date.now()}.${tempCounter++}.part`);

    try {
        const downloaded = await File.downloadFileAsync(remoteUrl, temp);
        if (!downloaded.exists || (downloaded.size ?? 0) === 0) {
            console.error(`audio cache: empty download for key "${cacheKey}"`);
            downloaded.delete();
            return { uri: null, reason: 'failed' };
        }

        const target = new File(getCacheDir(), fileName);
        if (target.exists) {
            target.delete();
        }
        downloaded.move(target);

        return { uri: target.uri };
    } catch (error) {
        try {
            if (temp.exists) temp.delete();
        } catch {
        }

        if (isMissingObjectError(error)) {
            console.error(
                `audio cache: storage object missing for key "${cacheKey}" — url ${remoteUrl.split('?')[0]}`
            );
            return { uri: null, reason: 'missing' };
        }

        console.error(`audio cache: download failed for key "${cacheKey}":`, error);
        return { uri: null, reason: 'failed' };
    }
};

export const cacheAudioFile = (
    remoteUrl: string,
    cacheKey: string
): Promise<AudioCacheResult> => {
    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = download(remoteUrl, cacheKey).finally(() => {
        inFlight.delete(cacheKey);
    });

    inFlight.set(cacheKey, request);
    return request;
};

export const clearAudioFileCache = (): void => {
    try {
        const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
        if (dir.exists) {
            dir.delete();
        }
    } catch {
    }
};
