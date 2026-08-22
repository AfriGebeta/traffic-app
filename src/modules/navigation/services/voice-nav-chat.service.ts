import type { VoiceNavEvent } from './voice-nav-socket.service';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface ChatStreamRequest {
    sessionId: string;
    text: string;
    originLat?: number;
    originLng?: number;
}

const DONE = '[DONE]';
export const streamChat = (
    request: ChatStreamRequest,
    onEvent: (event: VoiceNavEvent) => void,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let consumed = 0;

        const drain = (final: boolean) => {
            const text: string = xhr.responseText ?? '';
            let boundary = text.indexOf('\n\n', consumed);
            while (boundary !== -1) {
                emit(text.slice(consumed, boundary));
                consumed = boundary + 2;
                boundary = text.indexOf('\n\n', consumed);
            }
            if (final && consumed < text.length) {
                emit(text.slice(consumed));
                consumed = text.length;
            }
        };

        const emit = (frame: string) => {
            for (const line of frame.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === DONE) continue;
                try {
                    const event = JSON.parse(payload) as VoiceNavEvent;
                    console.log('voicenav: chat event', event?.type, JSON.stringify(event));
                    onEvent(event);
                } catch (error) {
                    console.log('voicenav: chat frame parse failed:', payload.slice(0, 200), error);
                }
            }
        };

        xhr.open('POST', `${API_URL}/api/asr/chat/stream`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');

        xhr.onprogress = () => drain(false);
        xhr.onerror = () => reject(new Error('chat stream request failed'));
        xhr.ontimeout = () => reject(new Error('chat stream timed out'));
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(`chat stream ${xhr.status}: ${String(xhr.responseText).slice(0, 200)}`));
                return;
            }
            drain(true);
            resolve();
        };

        xhr.send(JSON.stringify(request));
    });
