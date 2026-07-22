import { AudioContext, AudioManager } from 'react-native-audio-api';
import type AudioBufferQueueSourceNode from 'react-native-audio-api/lib/typescript/core/AudioBufferQueueSourceNode';

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

export class StreamingPcmPlayer {
    private ctx: AudioContext | null = null;
    private queue: AudioBufferQueueSourceNode | null = null;
    private sessionConfigured = false;
    private remainder: Uint8Array | null = null;
    private startedAt = 0;
    private enqueuedSeconds = 0;

    private recorded: Float32Array[] = [];
    private hasRecording = false;

    private onPlaybackEnd?: () => void;
    private endTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(onPlaybackEnd?: () => void) {
        this.onPlaybackEnd = onPlaybackEnd;
    }

    get canReplay(): boolean {
        return this.hasRecording;
    }

    private ensureContext(): void {
        if (!this.sessionConfigured) {
            try {
                AudioManager.setAudioSessionOptions({
                    iosCategory: 'playback',
                    iosMode: 'spokenAudio',
                    iosOptions: ['defaultToSpeaker', 'duckOthers'],
                });
                AudioManager.setAudioSessionActivity(true);
            } catch {
            }
            this.sessionConfigured = true;
        }

        if (!this.ctx) {
            this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
        }
        this.ctx.resume?.();
    }

    private clearEndTimer(): void {
        if (this.endTimer) {
            clearTimeout(this.endTimer);
            this.endTimer = null;
        }
    }

    private scheduleEnd(seconds: number): void {
        this.clearEndTimer();
        this.endTimer = setTimeout(() => {
            this.endTimer = null;
            this.onPlaybackEnd?.();
        }, Math.max(0, seconds * 1000));
    }

    start(): void {
        this.ensureContext();
        this.clearEndTimer();

        this.stopQueue();

        this.queue = this.ctx!.createBufferQueueSource();
        this.queue.connect(this.ctx!.destination);
        this.queue.start();
        this.remainder = null;
        this.startedAt = 0;
        this.enqueuedSeconds = 0;
        this.recorded = [];
        this.hasRecording = false;
        console.log('[VoiceNav] player started — ctx sampleRate', this.ctx!.sampleRate, 'state', this.ctx!.state);
    }

    push(chunk: Uint8Array): void {
        if (!this.ctx || chunk.length === 0) return;

        if (this.startedAt === 0 && this.queue) this.startedAt = this.ctx.currentTime;

        let bytes = chunk;
        if (this.remainder) {
            const merged = new Uint8Array(this.remainder.length + chunk.length);
            merged.set(this.remainder, 0);
            merged.set(chunk, this.remainder.length);
            bytes = merged;
            this.remainder = null;
        }

        const usableLen = bytes.length - (bytes.length % 2);
        if (usableLen !== bytes.length) {
            this.remainder = bytes.slice(usableLen);
            bytes = bytes.slice(0, usableLen);
        }
        if (bytes.length === 0) return;

        const sampleCount = bytes.length / 2;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const float = new Float32Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
            const s = view.getInt16(i * 2, true);
            float[i] = s / 32768;
        }

        this.recorded.push(float);

        if (!this.queue) return;

        try {
            const buffer = this.ctx.createBuffer(CHANNELS, sampleCount, SAMPLE_RATE);
            buffer.copyToChannel(float, 0);
            this.queue.enqueueBuffer(buffer);
            this.enqueuedSeconds += sampleCount / SAMPLE_RATE;
        } catch (err) {
            console.log('voice:player push failed:', String(err));
        }
    }

    finish(): void {
        if (!this.ctx || !this.queue) return;
        if (this.startedAt === 0) {
            this.stopQueue();
            return;
        }
        this.hasRecording = this.recorded.length > 0;
        const endsAt = this.startedAt + this.enqueuedSeconds;
        const stopAt = Math.max(this.ctx.currentTime, endsAt) + 0.15;
        try {
            this.queue.stop(stopAt);
        } catch {
        }
        const remaining = Math.max(0, stopAt - this.ctx.currentTime);
        this.scheduleEnd(remaining);
        console.log('voicenav:player finish draining', remaining.toFixed(2), 's of buffered audio');
    }

    replay(): void {
        if (!this.hasRecording || this.recorded.length === 0) return;
        this.ensureContext();
        this.stopQueue();

        const ctx = this.ctx!;
        const queue = ctx.createBufferQueueSource();
        queue.connect(ctx.destination);
        queue.start();
        this.queue = queue;

        let seconds = 0;
        const startTime = ctx.currentTime;
        for (const float of this.recorded) {
            try {
                const buffer = ctx.createBuffer(CHANNELS, float.length, SAMPLE_RATE);
                buffer.copyToChannel(float, 0);
                queue.enqueueBuffer(buffer);
                seconds += float.length / SAMPLE_RATE;
            } catch (err) {
                console.log('voice:player replay failed:', String(err));
            }
        }

        const stopAt = startTime + seconds + 0.15;
        try {
            queue.stop(stopAt);
        } catch {
        }
        this.scheduleEnd(seconds + 0.15);
    }
    stopPlayback(): void {
        this.clearEndTimer();
        this.stopQueue();
        this.hasRecording = this.recorded.length > 0;
    }

    private stopQueue(): void {
        try {
            this.queue?.clearBuffers();
            this.queue?.stop();
        } catch {
        }
        this.queue = null;
        this.remainder = null;
    }

    stop(): void {
        this.clearEndTimer();
        this.stopQueue();
        this.recorded = [];
        this.hasRecording = false;
    }

    dispose(): void {
        this.stop();
        try {
            this.ctx?.close();
        } catch {
        }
        this.ctx = null;
        this.sessionConfigured = false;
    }
}
