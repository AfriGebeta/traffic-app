import { Audio } from 'expo-av';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

interface CachedAudio {
    base64Uri: string;
    timestamp: number;
}

class TTSCacheService {
    private cache: Map<string, CachedAudio> = new Map();
    private readonly CACHE_EXPIRY_MS = 30 * 60 * 1000;
    private fetchQueue: Set<string> = new Set();

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
        if (this.cache.has(text) || this.fetchQueue.has(text)) {
            return true;
        }

        this.fetchQueue.add(text);

        try {
            const response = await fetch(`${API_URL}/api/asr/tts/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                return false;
            }

            const audioBlob = await response.blob();

            if (audioBlob.size === 0) {
                return false;
            }

            const base64Uri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(audioBlob);
            });

            this.cache.set(text, {
                base64Uri,
                timestamp: Date.now(),
            });

            return true;
        } catch (error: any) {
            return false;
        } finally {
            this.fetchQueue.delete(text);
        }
    }

    async playInstruction(text: string): Promise<boolean> {
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

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: cached.base64Uri },
                { shouldPlay: true, volume: 1.0 }
            );

            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    await sound.unloadAsync();
                }
            });

            return true;
        } catch (error) {
            return false;
        }
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
