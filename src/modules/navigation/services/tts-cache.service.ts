import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { fetchTtsAudioUri } from './tts-fetch';

interface CachedAudio {
    playbackUri: string;
    timestamp: number;
}

class TTSCacheService {
    private cache: Map<string, CachedAudio> = new Map();
    private readonly CACHE_EXPIRY_MS = 30 * 60 * 1000;
    private fetchQueue: Map<string, Promise<boolean>> = new Map();
    private activeSounds: Set<Audio.Sound> = new Set();
    private playGeneration = 0;

    async prefetchInstructions(instructions: string[]): Promise<void> {
        const batchSize = 3;
        for (let i = 0; i < instructions.length; i += batchSize) {
            const batch = instructions.slice(i, i + batchSize);
            await Promise.all(
                batch.map(instruction => this.fetchAndCache(instruction))
            );
        }
    }
    private async fetchAndCache(text: string): Promise<boolean> {
        if (this.cache.has(text)) {
            return true;
        }

        const inFlight = this.fetchQueue.get(text);
        if (inFlight) {
            return inFlight;
        }

        const promise = (async (): Promise<boolean> => {
            try {
                const playbackUri = await fetchTtsAudioUri(text);
                if (!playbackUri) {
                    return false;
                }

                this.cache.set(text, {
                    playbackUri,
                    timestamp: Date.now(),
                });

                return true;
            } catch (error: any) {
                return false;
            } finally {
                this.fetchQueue.delete(text);
            }
        })();

        this.fetchQueue.set(text, promise);
        return promise;
    }

    async playInstruction(text: string): Promise<boolean> {
        const generation = this.playGeneration;
        try {
            let cached = this.cache.get(text);

            if (!cached) {
                await this.fetchAndCache(text);
                cached = this.cache.get(text);
            }

            if (!cached) {
                return false;
            }

            if (Date.now() - cached.timestamp > this.CACHE_EXPIRY_MS) {
                this.cache.delete(text);
                await this.fetchAndCache(text);
                cached = this.cache.get(text);
                if (!cached) return false;
            }

            if (generation !== this.playGeneration) {
                return false;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                interruptionModeIOS: InterruptionModeIOS.DuckOthers,
                playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: cached.playbackUri },
                { shouldPlay: true, volume: 1.0 }
            );

            if (generation !== this.playGeneration) {
                await sound.unloadAsync().catch(() => {});
                return false;
            }

            this.activeSounds.add(sound);
            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    this.activeSounds.delete(sound);
                    await sound.unloadAsync();
                }
            });

            return true;
        } catch (error) {
            return false;
        }
    }

    async stopAll(): Promise<void> {
        this.playGeneration += 1;
        const sounds = [...this.activeSounds];
        this.activeSounds.clear();
        await Promise.all(
            sounds.map(async (sound) => {
                try {
                    await sound.stopAsync();
                } catch {
                }
                try {
                    await sound.unloadAsync();
                } catch {
                }
            })
        );
    }

    clearExpiredCache(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_EXPIRY_MS) {
                this.cache.delete(key);
            }
        }
    }

    clearCache(): void {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }
}

export const ttsCacheService = new TTSCacheService();
