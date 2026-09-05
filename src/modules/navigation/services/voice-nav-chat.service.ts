import type { VoiceNavEvent } from './voice-nav-socket.service';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface ChatStreamRequest {
    sessionId: string;
    text: string;
    originLat?: number;
    originLng?: number;
}

export const resetChatSession = async (sessionId: string): Promise<void> => {
    if (!sessionId) return;
    const url = `${API_URL}/api/asr/chat/reset`;
    const headers = { 'x-session-id': sessionId };
    console.log('voicenav: chat reset request', JSON.stringify({ url, method: 'POST', headers }));
    const startedAt = Date.now();
    try {
        const response = await fetch(url, { method: 'POST', headers });
        const body = await response.text();
        console.log(
            'voicenav: chat reset response',
            JSON.stringify({
                status: response.status,
                ok: response.ok,
                ms: Date.now() - startedAt,
                body: body.slice(0, 500),
            }),
        );
    } catch (error) {
        console.log(
            'voicenav: chat reset failed',
            JSON.stringify({ url, sessionId, ms: Date.now() - startedAt, error: String(error) }),
        );
    }
};

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

        const url = `${API_URL}/api/asr/chat/stream`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(request.sessionId ? { 'x-session-id': request.sessionId } : {}),
        };
        const body = JSON.stringify(request);
        const startedAt = Date.now();

        xhr.open('POST', url);
        for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);

        console.log(
            'voicenav: chat stream request',
            JSON.stringify({ url, method: 'POST', headers, sessionId: request.sessionId, body }),
        );

        xhr.onprogress = () => drain(false);
        xhr.onerror = () => {
            console.log(
                'voicenav: chat stream failed',
                JSON.stringify({ url, sessionId: request.sessionId, ms: Date.now() - startedAt }),
            );
            reject(new Error('chat stream request failed'));
        };
        xhr.ontimeout = () => {
            console.log(
                'voicenav: chat stream timeout',
                JSON.stringify({ url, sessionId: request.sessionId, ms: Date.now() - startedAt }),
            );
            reject(new Error('chat stream timed out'));
        };
        xhr.onload = () => {
            console.log(
                'voicenav: chat stream response',
                JSON.stringify({
                    status: xhr.status,
                    ms: Date.now() - startedAt,
                    sessionId: request.sessionId,
                    bytes: String(xhr.responseText ?? '').length,
                }),
            );
            if (xhr.status < 200 || xhr.status >= 300) {
                console.log(
                    'voicenav: chat stream error body',
                    String(xhr.responseText).slice(0, 500),
                );
                reject(new Error(`chat stream ${xhr.status}: ${String(xhr.responseText).slice(0, 200)}`));
                return;
            }
            drain(true);
            resolve();
        };

        xhr.send(body);
    });
