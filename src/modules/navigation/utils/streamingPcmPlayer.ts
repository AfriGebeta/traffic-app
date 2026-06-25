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

    start(): void {
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

        this.stop();

        this.queue = this.ctx.createBufferQueueSource();
        this.queue.connect(this.ctx.destination);
        this.queue.start();
        this.remainder = null;
        this.startedAt = this.ctx.currentTime;
        this.enqueuedSeconds = 0;
        console.log('[VoiceNav] player started — ctx sampleRate', this.ctx.sampleRate, 'state', this.ctx.state);
    }

    push(chunk: Uint8Array): void {
        if (!this.ctx || !this.queue || chunk.length === 0) return;

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
        const endsAt = this.startedAt + this.enqueuedSeconds;
        const stopAt = Math.max(this.ctx.currentTime, endsAt);
        try {
            this.queue.stop(stopAt);
        } catch {
        }
        const remaining = Math.max(0, endsAt - this.ctx.currentTime);
        console.log('voicenav:player finish draining', remaining.toFixed(2), 's of buffered audio');
    }

    stop(): void {
        try {
            this.queue?.clearBuffers();
            this.queue?.stop();
        } catch {
        }
        this.queue = null;
        this.remainder = null;
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
