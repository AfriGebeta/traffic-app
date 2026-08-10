import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { ttsService } from '../../modules/navigation/services/tts.service';

export type TtsPlaybackStatus = 'idle' | 'loading' | 'playing';

interface Options {
    language?: string;
    speaker_name?: string;
    shouldBeStored?: boolean;
    prefetch?: boolean;
}
export const useTtsPlayback = (text: string | string[], options: Options = {}) => {
    const { language, speaker_name, shouldBeStored, prefetch = false } = options;
    const [status, setStatus] = useState<TtsPlaybackStatus>('idle');
    const soundRef = useRef<Audio.Sound | null>(null);
    const mountedRef = useRef(true);
    const generationRef = useRef(0);

    const parts = useMemo(
        () => (Array.isArray(text) ? text : [text]).map(part => part.trim()).filter(Boolean),
        [text]
    );
    const partsKey = parts.join(' ');

    const unload = useCallback(async () => {
        const sound = soundRef.current;
        soundRef.current = null;
        if (!sound) return;
        try {
            await sound.stopAsync();
        } catch {
        }
        try {
            await sound.unloadAsync();
        } catch {
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            generationRef.current += 1;
            unload();
        };
    }, [unload]);

    const stop = useCallback(async () => {
        generationRef.current += 1;
        await unload();
        if (mountedRef.current) setStatus('idle');
    }, [unload]);

    const resolve = useCallback(
        (part: string) => ttsService.synthesizeSpeech(part, language, speaker_name, { shouldBeStored }),
        [language, shouldBeStored, speaker_name]
    );

    const playFile = useCallback(
        (uri: string, generation: number) =>
            new Promise<void>((done, reject) => {
                Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 })
                    .then(({ sound }) => {
                        if (generation !== generationRef.current || !mountedRef.current) {
                            sound.unloadAsync().catch(() => { });
                            done();
                            return;
                        }

                        soundRef.current = sound;
                        sound.setOnPlaybackStatusUpdate((playbackStatus) => {
                            if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
                                sound.setOnPlaybackStatusUpdate(null);
                                if (soundRef.current === sound) soundRef.current = null;
                                sound.unloadAsync().catch(() => { });
                                done();
                            }
                        });
                    })
                    .catch(reject);
            }),
        []
    );

    const play = useCallback(async () => {
        if (status !== 'idle') {
            await stop();
            return;
        }

        generationRef.current += 1;
        const generation = generationRef.current;
        setStatus('loading');

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            let nextUri = await resolve(parts[0]);

            for (let i = 0; i < parts.length; i++) {
                if (generation !== generationRef.current || !mountedRef.current) return false;

                const uri = nextUri;
                if (!uri) {
                    nextUri = i + 1 < parts.length ? await resolve(parts[i + 1]) : null;
                    continue;
                }

                if (i === 0) setStatus('playing');

                const upcoming =
                    i + 1 < parts.length ? resolve(parts[i + 1]) : Promise.resolve(null);

                await playFile(uri, generation);
                nextUri = await upcoming;
            }

            if (generation === generationRef.current && mountedRef.current) setStatus('idle');
            return true;
        } catch (error) {
            console.error('tts playback failed:', error);
            await unload();
            if (mountedRef.current) setStatus('idle');
            return false;
        }
    }, [parts, playFile, resolve, status, stop, unload]);

    useEffect(() => {
        if (!prefetch) return;
        let cancelled = false;

        (async () => {
            for (const part of parts) {
                if (cancelled) return;
                try {
                    await resolve(part);
                } catch {
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [partsKey, prefetch, resolve]);

    return { status, play, stop };
};
